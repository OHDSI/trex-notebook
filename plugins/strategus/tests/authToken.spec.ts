import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  setAuthToken,
  setAuthTokenSource,
  authHeaders,
  hostAuthHeaders,
  ensureAuthToken,
} from '../src/api/authToken';

const jwt = (claims: Record<string, unknown>) => `h.${btoa(JSON.stringify(claims))}.s`;

describe('authToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns no Authorization header when unset', () => {
    setAuthToken(null);
    expect(authHeaders()).toEqual({});
  });

  it('returns a Bearer header when set', () => {
    setAuthToken('abc123');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer abc123' });
  });

  it('reads a refreshed host token on every call', () => {
    let current = 'first';
    setAuthTokenSource(() => current);
    expect(hostAuthHeaders()).toEqual({ Authorization: 'Bearer first' });
    current = 'second';
    expect(hostAuthHeaders()).toEqual({ Authorization: 'Bearer second' });
  });

  it('drops the exchanged token once the host token changes', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: 'trex-1' })));
    vi.stubGlobal('fetch', fetchMock);
    let current = jwt({ aud: 'idp', exp: Date.now() / 1000 + 3600 });
    setAuthTokenSource(() => current);

    await ensureAuthToken();
    expect(authHeaders()).toEqual({ Authorization: 'Bearer trex-1' });

    current = jwt({ aud: 'idp', exp: Date.now() / 1000 + 7200 });
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${current}` });
  });
});
