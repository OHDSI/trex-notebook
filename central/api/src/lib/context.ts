import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { type Role, resolveRole } from './auth';
import { badRequest } from './errors';

export interface RequestContext {
  routeKey: string; // e.g. "POST /sites"
  pathParams: Record<string, string>;
  query: Record<string, string>;
  role: Role;
  rawBody: string | undefined;
  json<T>(): T; // parsed JSON body (throws 400 if invalid/empty)
}

export function buildContext(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): RequestContext {
  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  const role = resolveRole(claims as Record<string, unknown>);
  const rawBody = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
    : undefined;

  return {
    routeKey: event.routeKey,
    pathParams: (event.pathParameters ?? {}) as Record<string, string>,
    query: (event.queryStringParameters ?? {}) as Record<string, string>,
    role,
    rawBody,
    json<T>(): T {
      if (!rawBody) throw badRequest('INVALID_BODY', 'request body is required');
      try {
        return JSON.parse(rawBody) as T;
      } catch {
        throw badRequest('INVALID_BODY', 'request body is not valid JSON');
      }
    },
  };
}
