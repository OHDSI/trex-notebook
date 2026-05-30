import { PutCommand, GetCommand, UpdateCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  createStudySchema, updateStudySchema,
  type Study, type StudyWithUploads, type StudyPackage,
} from '@central/shared';
import type { RequestContext } from '../lib/context';
import type { Deps } from '../lib/deps';
import { created, ok, type HandlerResult } from '../lib/http';
import { requireCoordinator } from '../lib/auth';
import { badRequest, conflict, notFound, forbidden } from '../lib/errors';
import { presignPut, presignGet, headObject } from '../lib/s3util';

async function loadStudy(deps: Deps, studyId: string): Promise<Study> {
  const res = await deps.ddb.send(new GetCommand({ TableName: deps.env.studiesTable, Key: { studyId } }));
  if (!res.Item) throw notFound('STUDY_NOT_FOUND', `no study ${studyId}`);
  return res.Item as Study;
}

export async function createStudy(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const parsed = createStudySchema.safeParse(ctx.json());
  if (!parsed.success) throw badRequest('INVALID_BODY', 'invalid study', parsed.error.format());
  const studyId = deps.newId();
  const strategusKey = `studies/${studyId}/strategus.json`;
  const renvLockKey = `studies/${studyId}/renv.lock`;
  const study: Study = {
    studyId, name: parsed.data.name, description: parsed.data.description, version: parsed.data.version,
    status: 'draft', strategusKey, renvLockKey, createdAt: deps.now(),
  };
  await deps.ddb.send(new PutCommand({ TableName: deps.env.studiesTable, Item: study }));
  const body: StudyWithUploads = {
    study,
    uploads: {
      strategus: { filename: 'strategus.json', s3Key: strategusKey, url: await presignPut(deps.s3, deps.env.bucket, strategusKey) },
      renvLock: { filename: 'renv.lock', s3Key: renvLockKey, url: await presignPut(deps.s3, deps.env.bucket, renvLockKey) },
    },
  };
  return created(body);
}

export async function updateStudy(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const parsed = updateStudySchema.safeParse(ctx.json());
  if (!parsed.success) throw badRequest('INVALID_BODY', 'invalid patch', parsed.error.format());
  const study = await loadStudy(deps, ctx.pathParams.studyId);
  if (study.status !== 'draft') throw conflict('STUDY_NOT_DRAFT', 'only drafts can be edited');
  const sets: string[] = []; const names: Record<string, string> = {}; const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) { sets.push(`#${k} = :${k}`); names[`#${k}`] = k; values[`:${k}`] = v; }
  const res = await deps.ddb.send(new UpdateCommand({
    TableName: deps.env.studiesTable, Key: { studyId: ctx.pathParams.studyId },
    UpdateExpression: `SET ${sets.join(', ')}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return ok(res.Attributes);
}

export async function publishStudy(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const study = await loadStudy(deps, ctx.pathParams.studyId);
  const [a, b] = await Promise.all([
    headObject(deps.s3, deps.env.bucket, study.strategusKey),
    headObject(deps.s3, deps.env.bucket, study.renvLockKey),
  ]);
  if (!a.exists || !b.exists) throw conflict('STUDY_ARTIFACTS_MISSING', 'upload strategus.json and renv.lock before publishing');
  const res = await deps.ddb.send(new UpdateCommand({
    TableName: deps.env.studiesTable, Key: { studyId: study.studyId },
    UpdateExpression: 'SET #s = :published, publishedAt = :now',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':published': 'published', ':now': deps.now() },
    ReturnValues: 'ALL_NEW',
  }));
  return ok(res.Attributes);
}

export async function archiveStudy(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const res = await deps.ddb.send(new UpdateCommand({
    TableName: deps.env.studiesTable, Key: { studyId: ctx.pathParams.studyId },
    UpdateExpression: 'SET #s = :archived', ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':archived': 'archived' },
    ConditionExpression: 'attribute_exists(studyId)', ReturnValues: 'ALL_NEW',
  }));
  return ok(res.Attributes);
}

export async function listStudies(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  if (ctx.role.kind === 'coordinator') {
    const res = await deps.ddb.send(new ScanCommand({ TableName: deps.env.studiesTable }));
    return ok(res.Items ?? []);
  }
  const res = await deps.ddb.send(new QueryCommand({
    TableName: deps.env.studiesTable, IndexName: 'byStatus',
    KeyConditionExpression: '#s = :published', ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':published': 'published' },
  }));
  return ok(res.Items ?? []);
}

export async function getStudy(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  const study = await loadStudy(deps, ctx.pathParams.studyId);
  if (ctx.role.kind !== 'coordinator' && study.status !== 'published') throw forbidden('study is not published');
  return ok(study);
}

export async function getPackage(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  const study = await loadStudy(deps, ctx.pathParams.studyId);
  if (ctx.role.kind !== 'coordinator' && study.status !== 'published') throw forbidden('study is not published');
  const body: StudyPackage = {
    studyId: study.studyId,
    strategusUrl: await presignGet(deps.s3, deps.env.bucket, study.strategusKey),
    renvLockUrl: await presignGet(deps.s3, deps.env.bucket, study.renvLockKey),
  };
  return ok(body);
}
