import { describe, it, expect, vi } from 'vitest';
import { QueryCommand, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as s3util from '../../src/lib/s3util';
import {
  initiateSubmission, completeSubmission, listSubmissionsByStudy, listSubmissionsBySite, getSubmission,
} from '../../src/handlers/submissions';
import { makeCtx, makeMocks, ROLES } from '../helpers';

vi.mock('../../src/lib/s3util', () => ({
  presignPut: vi.fn(async (_s3: unknown, _b: string, key: string) => `https://put/${key}`),
  presignGet: vi.fn(async (_s3: unknown, _b: string, key: string) => `https://get/${key}`),
  headObject: vi.fn(),
}));

describe('initiateSubmission', () => {
  it('reserves version 1 and returns upload urls (site-operator)', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 'st1', status: 'published' } });
    ddb.on(QueryCommand).resolves({ Items: [] });
    ddb.on(PutCommand).resolves({});
    const ctx = makeCtx({ role: ROLES.operator('site-1'), pathParams: { studyId: 'st1' }, body: { files: [{ filename: 'results.db' }] } });
    const r = await initiateSubmission(ctx, deps);
    expect(r.statusCode).toBe(201);
    const body = JSON.parse(r.body);
    expect(body.version).toBe(1);
    expect(body.siteId).toBe('site-1');
    expect(body.status).toBe('pending');
    expect(body.urls[0].url).toBe('https://put/submissions/st1/site-1/1/results.db');
  });
  it('computes the next version from existing submissions', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 'st1', status: 'published' } });
    ddb.on(QueryCommand).resolves({ Items: [{ version: 1 }, { version: 2 }] });
    ddb.on(PutCommand).resolves({});
    const ctx = makeCtx({ role: ROLES.operator('site-1'), pathParams: { studyId: 'st1' }, body: { files: [{ filename: 'r.db' }] } });
    expect(JSON.parse((await initiateSubmission(ctx, deps)).body).version).toBe(3);
  });
  it('resolves siteId from clientId for a machine caller', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 'st1', status: 'published' } });
    ddb.on(QueryCommand).resolvesOnce({ Items: [{ siteId: 'site-9' }] }).resolves({ Items: [] });
    ddb.on(PutCommand).resolves({});
    const ctx = makeCtx({ role: ROLES.machine('client-abc'), pathParams: { studyId: 'st1' }, body: { files: [{ filename: 'r.db' }] } });
    expect(JSON.parse((await initiateSubmission(ctx, deps)).body).siteId).toBe('site-9');
  });
  it('rejects when study is not published', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 'st1', status: 'draft' } });
    const ctx = makeCtx({ role: ROLES.operator('site-1'), pathParams: { studyId: 'st1' }, body: { files: [{ filename: 'r.db' }] } });
    await expect(initiateSubmission(ctx, deps)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('completeSubmission', () => {
  it('409 when an expected object is missing (stays pending)', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 'st1', siteId: 'site-1', version: 1, status: 'pending', files: [{ filename: 'r.db', s3Key: 'submissions/st1/site-1/1/r.db', sizeBytes: 0, etag: '' }] } });
    vi.mocked(s3util.headObject).mockResolvedValue({ exists: false, sizeBytes: 0, etag: '' });
    const ctx = makeCtx({ role: ROLES.operator('site-1'), pathParams: { subId: 'st1__site-1__1' } });
    await expect(completeSubmission(ctx, deps)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('records sizes/etags and sets complete', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 'st1', siteId: 'site-1', version: 1, status: 'pending', files: [{ filename: 'r.db', s3Key: 'submissions/st1/site-1/1/r.db', sizeBytes: 0, etag: '' }] } });
    ddb.on(UpdateCommand).resolves({ Attributes: { studyId: 'st1', siteId: 'site-1', version: 1, status: 'complete' } });
    vi.mocked(s3util.headObject).mockResolvedValue({ exists: true, sizeBytes: 42, etag: 'abc' });
    const ctx = makeCtx({ role: ROLES.operator('site-1'), pathParams: { subId: 'st1__site-1__1' } });
    const r = await completeSubmission(ctx, deps);
    expect(JSON.parse(r.body).status).toBe('complete');
  });
  it('403 when operator site does not match the submission', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 'st1', siteId: 'site-1', version: 1, status: 'pending', files: [] } });
    const ctx = makeCtx({ role: ROLES.operator('other-site'), pathParams: { subId: 'st1__site-1__1' } });
    await expect(completeSubmission(ctx, deps)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('listSubmissionsByStudy', () => {
  it('coordinator: returns all sites for the study', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(QueryCommand).resolves({ Items: [
      { PK: 'STUDY#st1', SK: 'SITE#a#V#1', studyId: 'st1', siteId: 'a', version: 1 },
      { PK: 'STUDY#st1', SK: 'SITE#b#V#1', studyId: 'st1', siteId: 'b', version: 1 },
    ] });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { studyId: 'st1' } });
    const body = JSON.parse((await listSubmissionsByStudy(ctx, deps)).body);
    expect(body).toHaveLength(2);
    expect(body[0].PK).toBeUndefined();
  });
  it('site-operator: filtered to own site', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(QueryCommand).resolves({ Items: [
      { studyId: 'st1', siteId: 'a', version: 1, SK: 'SITE#a#V#1', PK: 'STUDY#st1' },
      { studyId: 'st1', siteId: 'b', version: 1, SK: 'SITE#b#V#1', PK: 'STUDY#st1' },
    ] });
    const ctx = makeCtx({ role: ROLES.operator('a'), pathParams: { studyId: 'st1' } });
    const body = JSON.parse((await listSubmissionsByStudy(ctx, deps)).body);
    expect(body).toHaveLength(1);
    expect(body[0].siteId).toBe('a');
  });
});

describe('listSubmissionsBySite', () => {
  it('403 when operator requests another site', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ role: ROLES.operator('a'), pathParams: { siteId: 'b' } });
    await expect(listSubmissionsBySite(ctx, deps)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('getSubmission', () => {
  it('returns submission with presigned GET urls', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: {
      PK: 'STUDY#st1', SK: 'SITE#a#V#1', studyId: 'st1', siteId: 'a', version: 1, status: 'complete',
      files: [{ filename: 'r.db', s3Key: 'submissions/st1/a/1/r.db', sizeBytes: 9, etag: 'e' }],
    } });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { subId: 'st1__a__1' } });
    const body = JSON.parse((await getSubmission(ctx, deps)).body);
    expect(body.urls[0].url).toBe('https://get/submissions/st1/a/1/r.db');
    expect(body.PK).toBeUndefined();
  });
});
