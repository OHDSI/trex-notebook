import { describe, it, expect, vi } from 'vitest';
import { PutCommand, GetCommand, UpdateCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as s3util from '../../src/lib/s3util';
import {
  createStudy, updateStudy, publishStudy, archiveStudy, listStudies, getStudy, getPackage,
} from '../../src/handlers/studies';
import { makeCtx, makeMocks, ROLES } from '../helpers';

vi.mock('../../src/lib/s3util', () => ({
  presignPut: vi.fn(async (_s3: unknown, _b: string, key: string) => `https://put/${key}`),
  presignGet: vi.fn(async (_s3: unknown, _b: string, key: string) => `https://get/${key}`),
  headObject: vi.fn(),
}));

describe('createStudy', () => {
  it('forbids non-coordinators', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ role: ROLES.operator('s1'), body: { name: 'S', description: '', version: '1.0.0' } });
    await expect(createStudy(ctx, deps)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('creates a draft and returns presigned PUT urls', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(PutCommand).resolves({});
    const ctx = makeCtx({ role: ROLES.coordinator, body: { name: 'My Study', description: 'd', version: '1.0.0' } });
    const r = await createStudy(ctx, deps);
    expect(r.statusCode).toBe(201);
    const body = JSON.parse(r.body);
    expect(body.study.status).toBe('draft');
    expect(body.study.studyId).toBe('id-1');
    expect(body.study.strategusKey).toBe('studies/id-1/strategus.json');
    expect(body.uploads.strategus.url).toBe('https://put/studies/id-1/strategus.json');
    expect(body.uploads.renvLock.url).toBe('https://put/studies/id-1/renv.lock');
  });
});

describe('publishStudy', () => {
  it('409 when artifacts are missing', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 's1', status: 'draft', strategusKey: 'studies/s1/strategus.json', renvLockKey: 'studies/s1/renv.lock' } });
    vi.mocked(s3util.headObject).mockResolvedValue({ exists: false, sizeBytes: 0, etag: '' });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { studyId: 's1' } });
    await expect(publishStudy(ctx, deps)).rejects.toMatchObject({ statusCode: 409, code: 'STUDY_ARTIFACTS_MISSING' });
  });
  it('publishes when both artifacts exist', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 's1', status: 'draft', strategusKey: 'studies/s1/strategus.json', renvLockKey: 'studies/s1/renv.lock' } });
    ddb.on(UpdateCommand).resolves({ Attributes: { studyId: 's1', status: 'published', publishedAt: '2026-05-30T00:00:00.000Z' } });
    vi.mocked(s3util.headObject).mockResolvedValue({ exists: true, sizeBytes: 10, etag: 'e' });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { studyId: 's1' } });
    const r = await publishStudy(ctx, deps);
    expect(JSON.parse(r.body).status).toBe('published');
  });
});

describe('archiveStudy', () => {
  it('sets status=archived', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(UpdateCommand).resolves({ Attributes: { studyId: 's1', status: 'archived' } });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { studyId: 's1' } });
    expect(JSON.parse((await archiveStudy(ctx, deps)).body).status).toBe('archived');
  });
});

describe('updateStudy', () => {
  it('409 when study is not a draft', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 's1', status: 'published' } });
    const ctx = makeCtx({ role: ROLES.coordinator, pathParams: { studyId: 's1' }, body: { name: 'X' } });
    await expect(updateStudy(ctx, deps)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('listStudies', () => {
  it('coordinator: scans all', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(ScanCommand).resolves({ Items: [{ studyId: 'a' }, { studyId: 'b' }] });
    const r = await listStudies(makeCtx({ role: ROLES.coordinator }), deps);
    expect(JSON.parse(r.body)).toHaveLength(2);
  });
  it('site-operator: queries published only', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(QueryCommand).resolves({ Items: [{ studyId: 'pub', status: 'published' }] });
    const r = await listStudies(makeCtx({ role: ROLES.operator('s1') }), deps);
    expect(JSON.parse(r.body)).toHaveLength(1);
    expect(ddb.commandCalls(QueryCommand)[0].args[0].input.IndexName).toBe('byStatus');
  });
});

describe('getPackage', () => {
  it('site-operator: 403 when study not published', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 's1', status: 'draft' } });
    const ctx = makeCtx({ role: ROLES.operator('s1'), pathParams: { studyId: 's1' } });
    await expect(getPackage(ctx, deps)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('returns presigned GET urls for published study', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 's1', status: 'published', strategusKey: 'studies/s1/strategus.json', renvLockKey: 'studies/s1/renv.lock' } });
    const ctx = makeCtx({ role: ROLES.operator('s1'), pathParams: { studyId: 's1' } });
    const r = await getPackage(ctx, deps);
    const body = JSON.parse(r.body);
    expect(body.strategusUrl).toBe('https://get/studies/s1/strategus.json');
    expect(body.renvLockUrl).toBe('https://get/studies/s1/renv.lock');
  });
});

describe('getStudy', () => {
  it('returns the study', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(GetCommand).resolves({ Item: { studyId: 's1', status: 'published' } });
    const r = await getStudy(makeCtx({ role: ROLES.coordinator, pathParams: { studyId: 's1' } }), deps);
    expect(JSON.parse(r.body).studyId).toBe('s1');
  });
});
