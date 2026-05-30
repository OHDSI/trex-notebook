import { describe, it, expect } from 'vitest';
import { resolveRole } from '../../src/lib/auth';
import { ApiError } from '../../src/lib/errors';

describe('resolveRole', () => {
  it('returns coordinator for the coordinator group', () => {
    const r = resolveRole({ 'cognito:groups': ['coordinator'], sub: 'u1' });
    expect(r).toEqual({ kind: 'coordinator', subject: 'user:u1' });
  });
  it('returns site-operator with siteId', () => {
    const r = resolveRole({ 'cognito:groups': ['site-operator'], siteId: 'site-1', sub: 'u2' });
    expect(r).toEqual({ kind: 'site-operator', siteId: 'site-1', subject: 'user:u2' });
  });
  it('parses a stringified groups claim', () => {
    const r = resolveRole({ 'cognito:groups': '[coordinator]', sub: 'u3' });
    expect(r.kind).toBe('coordinator');
  });
  it('returns machine for a client-credentials token (client_id, no groups)', () => {
    const r = resolveRole({ client_id: 'abc123', scope: 'network-api/site' });
    expect(r).toEqual({ kind: 'machine', clientId: 'abc123', subject: 'client:abc123' });
  });
  it('throws 403 when site-operator has no siteId', () => {
    expect(() => resolveRole({ 'cognito:groups': ['site-operator'], sub: 'u4' })).toThrow(ApiError);
  });
  it('throws 401 when no recognizable identity', () => {
    expect(() => resolveRole({ sub: 'u5' })).toThrow(ApiError);
  });
});
