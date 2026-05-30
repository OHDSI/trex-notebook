import { GetCommand, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { initiateSubmissionSchema, type Submission, type SubmissionWithUrls } from '@central/shared';
import type { RequestContext } from '../lib/context';
import type { Deps } from '../lib/deps';
import { created, ok, type HandlerResult } from '../lib/http';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { presignPut, presignGet, headObject } from '../lib/s3util';
import type { Role } from '../lib/auth';

const studyPk = (studyId: string) => `STUDY#${studyId}`;
const siteSk = (siteId: string, version: number) => `SITE#${siteId}#V#${version}`;

export async function resolveCallerSite(role: Role, deps: Deps): Promise<string> {
  if (role.kind === 'site-operator') return role.siteId;
  if (role.kind === 'machine') {
    const res = await deps.ddb.send(new QueryCommand({
      TableName: deps.env.sitesTable, IndexName: 'byClientId',
      KeyConditionExpression: 'cognitoClientId = :c',
      ExpressionAttributeValues: { ':c': role.clientId }, Limit: 1,
    }));
    const item = res.Items?.[0] as { siteId?: string } | undefined;
    if (!item?.siteId) throw forbidden('client is not bound to a site');
    return item.siteId;
  }
  throw forbidden('coordinators cannot create submissions');
}

async function nextVersion(deps: Deps, studyId: string, siteId: string): Promise<number> {
  const res = await deps.ddb.send(new QueryCommand({
    TableName: deps.env.submissionsTable,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sitePrefix)',
    ExpressionAttributeValues: { ':pk': studyPk(studyId), ':sitePrefix': `SITE#${siteId}#V#` },
  }));
  const versions = (res.Items ?? []).map((i) => Number((i as { version: number }).version));
  return versions.length ? Math.max(...versions) + 1 : 1;
}

export async function initiateSubmission(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  const parsed = initiateSubmissionSchema.safeParse(ctx.json());
  if (!parsed.success) throw badRequest('INVALID_BODY', 'invalid files', parsed.error.format());
  const studyId = ctx.pathParams.studyId;
  const study = await deps.ddb.send(new GetCommand({ TableName: deps.env.studiesTable, Key: { studyId } }));
  if (!study.Item) throw notFound('STUDY_NOT_FOUND', `no study ${studyId}`);
  if ((study.Item as { status: string }).status !== 'published') throw conflict('STUDY_NOT_PUBLISHED', 'study is not accepting submissions');

  const siteId = await resolveCallerSite(ctx.role, deps);

  for (let attempt = 0; attempt < 5; attempt++) {
    const version = await nextVersion(deps, studyId, siteId);
    const files = parsed.data.files.map((f) => ({
      filename: f.filename, s3Key: `submissions/${studyId}/${siteId}/${version}/${f.filename}`, sizeBytes: 0, etag: '',
    }));
    const submission: Submission = {
      studyId, siteId, version, status: 'pending', files, submittedAt: deps.now(), submittedBy: ctx.role.subject,
    };
    try {
      await deps.ddb.send(new PutCommand({
        TableName: deps.env.submissionsTable,
        Item: {
          PK: studyPk(studyId), SK: siteSk(siteId, version),
          GSI1PK: `SITE#${siteId}`, GSI1SK: `STUDY#${studyId}#V#${version}`,
          ...submission,
        },
        ConditionExpression: 'attribute_not_exists(SK)',
      }));
      const urls = await Promise.all(files.map(async (f) => ({ filename: f.filename, url: await presignPut(deps.s3, deps.env.bucket, f.s3Key) })));
      const body: SubmissionWithUrls = { ...submission, urls };
      return created(body);
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') continue;
      throw err;
    }
  }
  throw conflict('VERSION_CONFLICT', 'could not reserve a submission version, retry');
}

interface SubKey { studyId: string; siteId: string; version: number; }
function parseSubId(subId: string): SubKey {
  const [studyId, siteId, v] = subId.split('__');
  if (!studyId || !siteId || !v) throw badRequest('INVALID_SUBID', 'malformed submission id');
  return { studyId, siteId, version: Number(v) };
}

async function assertCallerOwnsSite(ctx: RequestContext, deps: Deps, siteId: string): Promise<void> {
  if (ctx.role.kind === 'coordinator') return;
  const callerSite = await resolveCallerSite(ctx.role, deps);
  if (callerSite !== siteId) throw forbidden('submission belongs to another site');
}

const INTERNAL_KEYS = ['PK', 'SK', 'GSI1PK', 'GSI1SK'];
function stripKeys(item: Record<string, unknown> | undefined): unknown {
  if (!item) return item;
  const rest: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(item)) {
    if (!INTERNAL_KEYS.includes(k)) rest[k] = val;
  }
  return rest;
}

export async function completeSubmission(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  const key = parseSubId(ctx.pathParams.subId);
  const res = await deps.ddb.send(new GetCommand({
    TableName: deps.env.submissionsTable, Key: { PK: studyPk(key.studyId), SK: siteSk(key.siteId, key.version) },
  }));
  if (!res.Item) throw notFound('SUBMISSION_NOT_FOUND', 'no such submission');
  const sub = res.Item as Submission;
  await assertCallerOwnsSite(ctx, deps, sub.siteId);
  const heads = await Promise.all(sub.files.map((f) => headObject(deps.s3, deps.env.bucket, f.s3Key)));
  if (heads.some((h) => !h.exists)) throw conflict('UPLOAD_INCOMPLETE', 'one or more files were not uploaded');
  const files = sub.files.map((f, i) => ({ ...f, sizeBytes: heads[i].sizeBytes, etag: heads[i].etag }));
  const updated = await deps.ddb.send(new UpdateCommand({
    TableName: deps.env.submissionsTable, Key: { PK: studyPk(key.studyId), SK: siteSk(key.siteId, key.version) },
    UpdateExpression: 'SET #s = :complete, files = :files', ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':complete': 'complete', ':files': files }, ReturnValues: 'ALL_NEW',
  }));
  return ok(stripKeys(updated.Attributes));
}

export async function listSubmissionsByStudy(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  const studyId = ctx.pathParams.studyId;
  const res = await deps.ddb.send(new QueryCommand({
    TableName: deps.env.submissionsTable, KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': studyPk(studyId) },
  }));
  let items = (res.Items ?? []) as Record<string, unknown>[];
  if (ctx.role.kind !== 'coordinator') {
    const siteId = await resolveCallerSite(ctx.role, deps);
    items = items.filter((i) => i.siteId === siteId);
  }
  return ok(items.map(stripKeys));
}

export async function listSubmissionsBySite(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  const siteId = ctx.pathParams.siteId;
  if (ctx.role.kind !== 'coordinator') {
    const callerSite = await resolveCallerSite(ctx.role, deps);
    if (callerSite !== siteId) throw forbidden('cannot read another site');
  }
  const res = await deps.ddb.send(new QueryCommand({
    TableName: deps.env.submissionsTable, IndexName: 'bySite',
    KeyConditionExpression: 'GSI1PK = :pk', ExpressionAttributeValues: { ':pk': `SITE#${siteId}` },
  }));
  return ok(((res.Items ?? []) as Record<string, unknown>[]).map(stripKeys));
}

export async function getSubmission(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  const key = parseSubId(ctx.pathParams.subId);
  const res = await deps.ddb.send(new GetCommand({
    TableName: deps.env.submissionsTable, Key: { PK: studyPk(key.studyId), SK: siteSk(key.siteId, key.version) },
  }));
  if (!res.Item) throw notFound('SUBMISSION_NOT_FOUND', 'no such submission');
  const sub = res.Item as Submission;
  await assertCallerOwnsSite(ctx, deps, sub.siteId);
  const urls = await Promise.all(sub.files.map(async (f) => ({ filename: f.filename, url: await presignGet(deps.s3, deps.env.bucket, f.s3Key) })));
  return ok({ ...(stripKeys(res.Item as Record<string, unknown>) as object), urls });
}
