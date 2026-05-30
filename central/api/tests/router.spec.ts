import { describe, it, expect } from 'vitest';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { route } from '../src/router';
import { errorResult } from '../src/lib/http';
import { makeCtx, makeMocks, ROLES } from './helpers';

describe('route', () => {
  it('dispatches GET /health', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ routeKey: 'GET /health', role: ROLES.coordinator });
    const r = await route(ctx, deps);
    expect(r.statusCode).toBe(200);
  });

  it('returns 404 for an unknown route', async () => {
    const { deps } = makeMocks();
    const ctx = makeCtx({ routeKey: 'DELETE /nope', role: ROLES.coordinator });
    const r = await route(ctx, deps).catch(errorResult);
    expect(r.statusCode).toBe(404);
    expect(JSON.parse(r.body).error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('dispatches GET /studies to listStudies', async () => {
    const { ddb, deps } = makeMocks();
    ddb.on(ScanCommand).resolves({ Items: [] });
    const r = await route(makeCtx({ routeKey: 'GET /studies', role: ROLES.coordinator }), deps);
    expect(r.statusCode).toBe(200);
  });

  it('dispatches POST /sites to createSite path (validation runs)', async () => {
    const { deps } = makeMocks();
    const r = await route(
      makeCtx({ routeKey: 'POST /sites', role: ROLES.coordinator, body: { name: '', contact: '' } }),
      deps,
    ).catch((e) => e);
    expect(r.statusCode).toBe(400);
  });
});
