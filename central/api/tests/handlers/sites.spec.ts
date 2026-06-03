import { describe, it, expect } from 'vitest';
import {
  CreateUserPoolClientCommand,
  DeleteUserPoolClientCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { PutCommand, ScanCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  createSite, listSites, getSite, updateSite, rotateSecret, createOperator, deleteSite, approveSite,
} from '../../src/handlers/sites';
import { makeCtx, makeMocks, ROLES } from '../helpers';
import { ApiError } from '../../src/lib/errors';

describe('createSite', () => {
  it('forbids non-coordinators', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ role: ROLES.operator('s1'), body: { name: 'A', contact: 'a@x.org' } });
    await expect(createSite(ctx, deps)).rejects.toBeInstanceOf(ApiError);
  });
  it('validates the body', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ role: ROLES.coordinator, body: { name: '', contact: 'a@x.org' } });
    await expect(createSite(ctx, deps)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('creates a cognito client + site record and returns the secret once', async () => {
    const { ddb, cognito, deps } = makeMocks();
    cognito.on(CreateUserPoolClientCommand).resolves({ UserPoolClient: { ClientId: 'cid-1', ClientSecret: 'secret-xyz' } });
    ddb.on(PutCommand).resolves({});
    const ctx = makeCtx({ role: ROLES.coordinator, body: { name: 'Site A', contact: 'a@x.org' } });
    const r = await createSite(ctx, deps);
    expect(r.statusCode).toBe(201);
    const body = JSON.parse(r.body);
    expect(body.clientSecret).toBe('secret-xyz');
    expect(body.cognitoClientId).toBe('cid-1');
    expect(body.siteId).toBe('id-1');
    expect(body.status).toBe('active');
  });
  it('deletes the orphaned cognito client if the DB write fails', async () => {
    const { ddb, cognito, deps } = makeMocks();
    cognito.on(CreateUserPoolClientCommand).resolves({ UserPoolClient: { ClientId: 'cid-2', ClientSecret: 's2' } });
    ddb.on(PutCommand).rejects(new Error('ddb down'));
    const ctx = makeCtx({ role: ROLES.coordinator, body: { name: 'B', contact: 'b@x.org' } });
    await expect(createSite(ctx, deps)).rejects.toBeTruthy();
    const deletes = cognito.commandCalls(DeleteUserPoolClientCommand);
    expect(deletes.length).toBe(1);
    expect(deletes[0].args[0].input.ClientId).toBe('cid-2');
  });
});

describe('listSites', () => {
  it('returns all sites for a coordinator', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(ScanCommand).resolves({ Items: [{ siteId: 's1' }, { siteId: 's2' }] });
    const r = await listSites(makeCtx({ role: ROLES.coordinator }), deps);
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toHaveLength(2);
  });
  it('forbids non-coordinators', async () => {
    const { deps } = makeMocks();
    await expect(listSites(makeCtx({ role: ROLES.operator('s1') }), deps)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('getSite', () => {
  it('returns 404 when missing', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: undefined });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 'x' } });
    await expect(getSite(ctx, deps)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('returns the site (no secret) when found', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', name: 'A' } });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' } });
    const r = await getSite(ctx, deps);
    expect(JSON.parse(r.body)).toMatchObject({ siteId: 's1' });
    expect(JSON.parse(r.body).clientSecret).toBeUndefined();
  });
});

describe('updateSite', () => {
  it('updates name and status', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(UpdateCommand).resolves({ Attributes: { siteId: 's1', name: 'New', status: 'disabled' } });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' }, body: { name: 'New', status: 'disabled' } });
    const r = await updateSite(ctx, deps);
    expect(JSON.parse(r.body)).toMatchObject({ name: 'New', status: 'disabled' });
  });
  it('rejects an empty patch', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' }, body: {} });
    await expect(updateSite(ctx, deps)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('rotateSecret', () => {
  it('returns 404 when site missing', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: undefined });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 'x' } });
    await expect(rotateSecret(ctx, deps)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('creates a new client and returns the new secret', async () => {
    const { ddb, cognito, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', cognitoClientId: 'old-cid' } });
    cognito.on(CreateUserPoolClientCommand).resolves({ UserPoolClient: { ClientId: 'new-cid', ClientSecret: 'new-sec' } });
    ddb.on(UpdateCommand).resolves({});
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' } });
    const r = await rotateSecret(ctx, deps);
    const body = JSON.parse(r.body);
    expect(body.cognitoClientId).toBe('new-cid');
    expect(body.clientSecret).toBe('new-sec');
    expect(cognito.commandCalls(DeleteUserPoolClientCommand)[0].args[0].input.ClientId).toBe('old-cid');
  });
});

describe('createOperator', () => {
  it('creates a user with custom:siteId and adds to site-operator group', async () => {
    const { ddb, cognito, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', name: 'A' } });
    cognito.on(AdminCreateUserCommand).resolves({ User: { Username: 'op@x.org' } });
    cognito.on(AdminAddUserToGroupCommand).resolves({});
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' }, body: { email: 'op@x.org' } });
    const r = await createOperator(ctx, deps);
    expect(r.statusCode).toBe(201);
    const create = cognito.commandCalls(AdminCreateUserCommand)[0].args[0].input;
    expect(create.UserAttributes).toContainEqual({ Name: 'custom:siteId', Value: 's1' });
    expect(cognito.commandCalls(AdminAddUserToGroupCommand)[0].args[0].input.GroupName).toBe('site-operator');
  });
  it('returns 404 if the site does not exist', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: undefined });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 'x' }, body: { email: 'op@x.org' } });
    await expect(createOperator(ctx, deps)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('deleteSite', () => {
  it('forbids non-coordinators', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ role: ROLES.operator('s1'), pathParams: { siteId: 's1' } });
    await expect(deleteSite(ctx, deps)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('returns 404 when the site does not exist', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: undefined });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 'x' } });
    await expect(deleteSite(ctx, deps)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('deletes the cognito client and the record, returns 204', async () => {
    const { ddb, cognito, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', cognitoClientId: 'cid-1' } });
    cognito.on(DeleteUserPoolClientCommand).resolves({});
    ddb.on(DeleteCommand).resolves({});
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' } });
    const r = await deleteSite(ctx, deps);
    expect(r.statusCode).toBe(204);
    expect(cognito.commandCalls(DeleteUserPoolClientCommand)[0].args[0].input.ClientId).toBe('cid-1');
    expect(ddb.commandCalls(DeleteCommand)[0].args[0].input.Key).toEqual({ siteId: 's1' });
  });
});

describe('approveSite', () => {
  it('forbids non-coordinators', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ role: ROLES.operator('s1'), pathParams: { siteId: 's1' } });
    await expect(approveSite(ctx, deps)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('409 when the site is not pending', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', status: 'active' } });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' } });
    await expect(approveSite(ctx, deps)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('provisions a cognito client and stashes the secret for claim', async () => {
    const { ddb, cognito, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', name: 'A', contact: 'a@x.org', status: 'pending' } });
    cognito.on(CreateUserPoolClientCommand).resolves({ UserPoolClient: { ClientId: 'cid-9', ClientSecret: 'sek-9' } });
    ddb.on(UpdateCommand).resolves({ Attributes: { siteId: 's1', name: 'A', contact: 'a@x.org', status: 'active', cognitoClientId: 'cid-9', pendingSecret: 'sek-9' } });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' } });
    const r = await approveSite(ctx, deps);
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.status).toBe('active');
    expect(body.cognitoClientId).toBe('cid-9');
    expect(body.pendingSecret).toBeUndefined(); // never returned to the coordinator
    const upd = ddb.commandCalls(UpdateCommand)[0].args[0].input as any;
    expect(upd.ExpressionAttributeValues[':p']).toBe('sek-9');
  });
  it('deletes the orphaned cognito client if the update fails', async () => {
    const { ddb, cognito, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { siteId: 's1', name: 'A', contact: 'a@x.org', status: 'pending' } });
    cognito.on(CreateUserPoolClientCommand).resolves({ UserPoolClient: { ClientId: 'cid-x', ClientSecret: 'sek-x' } });
    ddb.on(UpdateCommand).rejects(new Error('ddb down'));
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { siteId: 's1' } });
    await expect(approveSite(ctx, deps)).rejects.toBeTruthy();
    const deletes = cognito.commandCalls(DeleteUserPoolClientCommand);
    expect(deletes.length).toBe(1);
    expect(deletes[0].args[0].input.ClientId).toBe('cid-x');
  });
});
