import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { buildContext } from './lib/context';
import { route } from './router';
import { errorResult } from './lib/http';
import { makeDeps } from './lib/deps';
import { health } from './handlers/health';

const deps = makeDeps();

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  try {
    // /health is exposed unauthenticated (no JWT authorizer) — handle it before
    // role resolution, which would otherwise reject the tokenless request.
    if (event.routeKey === 'GET /health') {
      return await health();
    }
    const ctx = buildContext(event);
    const result = await route(ctx, deps);
    return result;
  } catch (err) {
    return errorResult(err);
  }
}
