import { ApiError } from './errors';

export interface HandlerResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const JSON_HEADERS = { 'content-type': 'application/json' };

export function ok(body: unknown): HandlerResult {
  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

export function created(body: unknown): HandlerResult {
  return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

export function noContent(): HandlerResult {
  return { statusCode: 204, headers: {}, body: '' };
}

export function errorResult(err: unknown): HandlerResult {
  if (err instanceof ApiError) {
    return {
      statusCode: err.statusCode,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        error: { code: err.code, message: err.message, details: err.details },
      }),
    };
  }
  // Log unexpected (non-ApiError) failures so a 500 isn't silent in CloudWatch.
  console.error('[errorResult] unhandled error:', err);
  return {
    statusCode: 500,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error: { code: 'INTERNAL', message: 'internal error' } }),
  };
}
