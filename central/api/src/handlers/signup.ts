import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { signupSchema, type Site } from '@central/shared';
import type { Deps } from '../lib/deps';
import { created, ok, type HandlerResult } from '../lib/http';
import { badRequest, notFound, forbidden } from '../lib/errors';
import { hashToken, tokenMatches } from '../lib/ids';

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) throw badRequest('INVALID_BODY', 'request body is required');
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest('INVALID_BODY', 'request body is not valid JSON');
  }
}

// POST /signup  (PUBLIC) — create a pending site request, return a one-time claim token.
export async function createSignup(event: APIGatewayProxyEventV2, deps: Deps): Promise<HandlerResult> {
  const parsed = signupSchema.safeParse(parseBody(event));
  if (!parsed.success) throw badRequest('INVALID_BODY', 'invalid signup', parsed.error.format());

  const siteId = deps.newId();
  const claimToken = deps.newToken();
  const item: Site & { claimTokenHash: string } = {
    siteId,
    name: parsed.data.name,
    contact: parsed.data.contact,
    status: 'pending',
    cognitoClientId: '',
    createdAt: deps.now(),
    createdBy: 'signup',
    claimTokenHash: hashToken(claimToken),
  };
  await deps.ddb.send(new PutCommand({ TableName: deps.env.sitesTable, Item: item }));
  return created({ siteId, claimToken });
}

// GET /signup/{siteId}  (PUBLIC, X-Signup-Token header) — status; once active, the creds ONCE.
export async function claimSignup(event: APIGatewayProxyEventV2, deps: Deps): Promise<HandlerResult> {
  const siteId = event.pathParameters?.siteId ?? '';
  const token = event.headers?.['x-signup-token'] ?? event.headers?.['X-Signup-Token'] ?? '';
  const res = await deps.ddb.send(new GetCommand({ TableName: deps.env.sitesTable, Key: { siteId } }));
  const item = res.Item as (Site & { claimTokenHash?: string; pendingSecret?: string }) | undefined;
  if (!item) throw notFound('SITE_NOT_FOUND', `no site ${siteId}`);
  if (!item.claimTokenHash || !tokenMatches(token, item.claimTokenHash)) {
    throw forbidden('invalid signup token');
  }
  if (item.status === 'active' && item.pendingSecret) {
    await deps.ddb.send(
      new UpdateCommand({
        TableName: deps.env.sitesTable,
        Key: { siteId },
        UpdateExpression: 'REMOVE pendingSecret, claimTokenHash',
      }),
    );
    return ok({ status: 'active', cognitoClientId: item.cognitoClientId, clientSecret: item.pendingSecret });
  }
  return ok({ status: item.status });
}
