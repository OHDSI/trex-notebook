import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  setAuthToken,
  setAuthTokenSource,
  getAuthToken,
  authHeaders,
} from '../../src/api/authToken';
import { ApiClient } from '../../src/api/client';
import { HadesClient } from '../../src/api/hadesClient';

const RS256_TOKEN = [
  btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
  btoa(JSON.stringify({ sub: 'u1', aud: 'https://idp', exp: Math.floor(Date.now() / 1000) + 3600 })),
  'sig',
].join('.');

describe('authToken', () => {
  afterEach(() => {
    setAuthToken(null);
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
  it('getAuthToken returns the current token', () => {
    setAuthToken('tok99');
    expect(getAuthToken()).toBe('tok99');
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });
  it('reads the host token on every call so refreshes are picked up', () => {
    const host = { token: 'first' as string | null };
    setAuthTokenSource(() => host.token);
    expect(getAuthToken()).toBe('first');
    host.token = 'second';
    expect(authHeaders()).toEqual({ Authorization: 'Bearer second' });
  });

  it('sends the host IdP token to network-api without a /trex-token exchange', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setAuthToken(RS256_TOKEN);
    await new ApiClient('https://host/network-api', getAuthToken, fetchMock).get('/studies');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://host/network-api/studies');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${RS256_TOKEN}`);
  });

  it('sends the host IdP token to hades-api without a /trex-token exchange', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ jobId: 'j1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setAuthToken(RS256_TOKEN);
    await new HadesClient('https://host/hades-api', fetchMock).getJob('j1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://host/hades-api/jobs/j1');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${RS256_TOKEN}`);
  });
});
