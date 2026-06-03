import { describe, it, expect } from 'vitest';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createSignup, claimSignup } from '../../src/handlers/signup';
import { makeMocks } from '../helpers';
import { hashToken } from '../../src/lib/ids';

function event(opts: { body?: unknown; pathParams?: Record<string, string>; headers?: Record<string, string> }) {
  return {
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    isBase64Encoded: false,
    pathParameters: opts.pathParams ?? {},
    headers: opts.headers ?? {},
  } as any;
}

describe('createSignup', () => {
  it('rejects an invalid body', async () => {
    const { deps } = makeMocks();
    await expect(createSignup(event({ body: { name: '' } }), deps)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('creates a pending site and returns siteId + claimToken once', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(PutCommand).resolves({});
    const r = await createSignup(event({ body: { name: 'Site A', contact: 'a@x.org' } }), deps);
    expect(r.statusCode).toBe(201);
    const body = JSON.parse(r.body);
    expect(body.siteId).toBe('id-1');
    expect(body.claimToken).toBe('tok-test');
    const put = ddb.commandCalls(PutCommand)[0].args[0].input.Item as any;
    expect(put.status).toBe('pending');
    expect(put.cognitoClientId).toBe('');
    expect(put.claimTokenHash).toBe(hashToken('tok-test'));
    expect(put.pendingSecret).toBeUndefined();
  });
});

describe('claimSignup', () => {
  it('404 when the site is unknown', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: undefined });
    await expect(
      claimSignup(event({ pathParams: { siteId: 'x' }, headers: { 'x-signup-token': 'tok-test' } }), deps),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('403 on token mismatch', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', status: 'pending', claimTokenHash: hashToken('right') } });
    await expect(
      claimSignup(event({ pathParams: { siteId: 's1' }, headers: { 'x-signup-token': 'wrong' } }), deps),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it('returns just status while pending', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', status: 'pending', claimTokenHash: hashToken('tok-test') } });
    const r = await claimSignup(event({ pathParams: { siteId: 's1' }, headers: { 'x-signup-token': 'tok-test' } }), deps);
    expect(JSON.parse(r.body)).toEqual({ status: 'pending' });
  });
  it('returns credentials once when active, then clears them', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({
      Item: { siteId: 's1', status: 'active', cognitoClientId: 'cid-1', pendingSecret: 'sek', claimTokenHash: hashToken('tok-test') },
    });
    ddb.on(UpdateCommand).resolves({});
    const r = await claimSignup(event({ pathParams: { siteId: 's1' }, headers: { 'x-signup-token': 'tok-test' } }), deps);
    expect(JSON.parse(r.body)).toEqual({ status: 'active', cognitoClientId: 'cid-1', clientSecret: 'sek' });
    const upd = ddb.commandCalls(UpdateCommand)[0].args[0].input as any;
    expect(upd.UpdateExpression).toMatch(/REMOVE/i);
    expect(upd.UpdateExpression).toMatch(/pendingSecret/);
  });
  it('active but already claimed (no pendingSecret) → status only', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', status: 'active', cognitoClientId: 'cid-1', claimTokenHash: hashToken('tok-test') } });
    const r = await claimSignup(event({ pathParams: { siteId: 's1' }, headers: { 'x-signup-token': 'tok-test' } }), deps);
    expect(JSON.parse(r.body)).toEqual({ status: 'active' });
  });
});
