import {
  CreateUserPoolClientCommand,
  DeleteUserPoolClientCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { PutCommand, ScanCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  createSiteSchema,
  updateSiteSchema,
  createOperatorSchema,
  type Site,
  type SiteWithSecret,
} from '@central/shared';
import type { RequestContext } from '../lib/context';
import type { Deps } from '../lib/deps';
import { created, ok, noContent, type HandlerResult } from '../lib/http';
import { requireCoordinator } from '../lib/auth';
import { badRequest, notFound, conflict } from '../lib/errors';

function publicSite<T extends Record<string, unknown>>(item: T): Omit<T, 'pendingSecret' | 'claimTokenHash'> {
  const { pendingSecret: _p, claimTokenHash: _h, ...rest } = item as Record<string, unknown>;
  return rest as Omit<T, 'pendingSecret' | 'claimTokenHash'>;
}

export async function createSite(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const parsed = createSiteSchema.safeParse(ctx.json());
  if (!parsed.success) throw badRequest('INVALID_BODY', 'invalid site', parsed.error.format());

  const siteId = deps.newId();
  const clientRes = await deps.cognito.send(
    new CreateUserPoolClientCommand({
      UserPoolId: deps.env.userPoolId,
      ClientName: `site-${siteId}`,
      GenerateSecret: true,
      AllowedOAuthFlows: ['client_credentials'],
      AllowedOAuthScopes: [deps.env.resourceServerScope],
      AllowedOAuthFlowsUserPoolClient: true,
      ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
    }),
  );
  const cognitoClientId = clientRes.UserPoolClient?.ClientId ?? '';
  const clientSecret = clientRes.UserPoolClient?.ClientSecret ?? '';

  const site: Site = {
    siteId,
    name: parsed.data.name,
    contact: parsed.data.contact,
    status: 'active',
    cognitoClientId,
    createdAt: deps.now(),
    createdBy: ctx.role.subject,
  };
  try {
    await deps.ddb.send(new PutCommand({ TableName: deps.env.sitesTable, Item: site }));
  } catch (err) {
    await Promise.resolve(
      deps.cognito.send(
        new DeleteUserPoolClientCommand({ UserPoolId: deps.env.userPoolId, ClientId: cognitoClientId }),
      ),
    ).catch(() => {});
    throw err;
  }
  const body: SiteWithSecret = { ...site, clientSecret };
  return created(body);
}

export async function listSites(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const res = await deps.ddb.send(new ScanCommand({ TableName: deps.env.sitesTable }));
  return ok((res.Items ?? []).map((i) => publicSite(i as Record<string, unknown>)));
}

export async function getSite(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const siteId = ctx.pathParams.siteId;
  const res = await deps.ddb.send(new GetCommand({ TableName: deps.env.sitesTable, Key: { siteId } }));
  if (!res.Item) throw notFound('SITE_NOT_FOUND', `no site ${siteId}`);
  return ok(publicSite(res.Item as Record<string, unknown>));
}

export async function updateSite(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const parsed = updateSiteSchema.safeParse(ctx.json());
  if (!parsed.success) throw badRequest('INVALID_BODY', 'invalid patch', parsed.error.format());
  const sets: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    sets.push(`#${k} = :${k}`);
    names[`#${k}`] = k;
    values[`:${k}`] = v;
  }
  const res = await deps.ddb.send(
    new UpdateCommand({
      TableName: deps.env.sitesTable,
      Key: { siteId: ctx.pathParams.siteId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(siteId)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  return ok(res.Attributes);
}

export async function rotateSecret(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const siteId = ctx.pathParams.siteId;
  const site = await deps.ddb.send(new GetCommand({ TableName: deps.env.sitesTable, Key: { siteId } }));
  if (!site.Item) throw notFound('SITE_NOT_FOUND', `no site ${siteId}`);
  const fresh = await deps.cognito.send(
    new CreateUserPoolClientCommand({
      UserPoolId: deps.env.userPoolId,
      ClientName: `site-${siteId}-${deps.newId()}`,
      GenerateSecret: true,
      AllowedOAuthFlows: ['client_credentials'],
      AllowedOAuthScopes: [deps.env.resourceServerScope],
      AllowedOAuthFlowsUserPoolClient: true,
      ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
    }),
  );
  const newClientId = fresh.UserPoolClient?.ClientId ?? '';
  const newSecret = fresh.UserPoolClient?.ClientSecret ?? '';
  const oldClientId = (site.Item as { cognitoClientId: string }).cognitoClientId;
  await deps.ddb.send(
    new UpdateCommand({
      TableName: deps.env.sitesTable,
      Key: { siteId },
      UpdateExpression: 'SET cognitoClientId = :c',
      ExpressionAttributeValues: { ':c': newClientId },
    }),
  );
  await Promise.resolve(
    deps.cognito.send(new DeleteUserPoolClientCommand({ UserPoolId: deps.env.userPoolId, ClientId: oldClientId })),
  ).catch(() => {});
  return ok({ ...(site.Item as object), cognitoClientId: newClientId, clientSecret: newSecret });
}

export async function createOperator(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const siteId = ctx.pathParams.siteId;
  const parsed = createOperatorSchema.safeParse(ctx.json());
  if (!parsed.success) throw badRequest('INVALID_BODY', 'invalid operator', parsed.error.format());
  const site = await deps.ddb.send(new GetCommand({ TableName: deps.env.sitesTable, Key: { siteId } }));
  if (!site.Item) throw notFound('SITE_NOT_FOUND', `no site ${siteId}`);
  await deps.cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: deps.env.userPoolId,
      Username: parsed.data.email,
      UserAttributes: [
        { Name: 'email', Value: parsed.data.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:siteId', Value: siteId },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    }),
  );
  await deps.cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: deps.env.userPoolId,
      Username: parsed.data.email,
      GroupName: 'site-operator',
    }),
  );
  return created({ email: parsed.data.email, siteId });
}

export async function deleteSite(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const siteId = ctx.pathParams.siteId;
  const res = await deps.ddb.send(new GetCommand({ TableName: deps.env.sitesTable, Key: { siteId } }));
  if (!res.Item) throw notFound('SITE_NOT_FOUND', `no site ${siteId}`);
  const clientId = (res.Item as Site).cognitoClientId;
  // remove the machine app client (best-effort), then the record
  await Promise.resolve(
    deps.cognito.send(new DeleteUserPoolClientCommand({ UserPoolId: deps.env.userPoolId, ClientId: clientId })),
  ).catch(() => {});
  await deps.ddb.send(new DeleteCommand({ TableName: deps.env.sitesTable, Key: { siteId } }));
  return noContent();
}

export async function approveSite(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  requireCoordinator(ctx.role);
  const siteId = ctx.pathParams.siteId;
  const res = await deps.ddb.send(new GetCommand({ TableName: deps.env.sitesTable, Key: { siteId } }));
  const item = res.Item as (Site & { status: string }) | undefined;
  if (!item) throw notFound('SITE_NOT_FOUND', `no site ${siteId}`);
  if (item.status !== 'pending') throw conflict('NOT_PENDING', `site ${siteId} is not pending`);

  const clientRes = await deps.cognito.send(
    new CreateUserPoolClientCommand({
      UserPoolId: deps.env.userPoolId,
      ClientName: `site-${siteId}`,
      GenerateSecret: true,
      AllowedOAuthFlows: ['client_credentials'],
      AllowedOAuthScopes: [deps.env.resourceServerScope],
      AllowedOAuthFlowsUserPoolClient: true,
      ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
    }),
  );
  const cognitoClientId = clientRes.UserPoolClient?.ClientId ?? '';
  const clientSecret = clientRes.UserPoolClient?.ClientSecret ?? '';

  let updated;
  try {
    updated = await deps.ddb.send(
      new UpdateCommand({
        TableName: deps.env.sitesTable,
        Key: { siteId },
        UpdateExpression: 'SET #s = :a, cognitoClientId = :c, pendingSecret = :p',
        ConditionExpression: '#s = :pending',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':a': 'active', ':c': cognitoClientId, ':p': clientSecret, ':pending': 'pending' },
        ReturnValues: 'ALL_NEW',
      }),
    );
  } catch (err) {
    await Promise.resolve(
      deps.cognito.send(
        new DeleteUserPoolClientCommand({ UserPoolId: deps.env.userPoolId, ClientId: cognitoClientId }),
      ),
    ).catch(() => {});
    throw err;
  }
  return ok(publicSite((updated.Attributes ?? {}) as Record<string, unknown>));
}
