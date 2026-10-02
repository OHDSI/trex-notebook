import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAuthToken, authHeaders, ensureAuthToken, getWebApiToken } from '../src/api/authToken';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(payload));
  return `header.${b64}.sig`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;

describe('authToken', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it('returns no Authorization header when unset', () => {
    expect(authHeaders()).toEqual({});
  });

  it('returns a Bearer header when set', () => {
    setAuthToken('abc123');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer abc123' });
  });

  it('getWebApiToken returns null when no token is set', () => {
    expect(getWebApiToken()).toBeNull();
  });

  it('getWebApiToken returns the raw token unchanged, even after an exchange has run', async () => {
    const rs256 = fakeJwt({ aud: 'https://alp-default', exp: future() });
    setAuthToken(rs256);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: fakeJwt({ aud: 'authenticated', exp: future() }) }),
    }));
    await ensureAuthToken();
    expect(getWebApiToken()).toBe(rs256);
    expect(authHeaders().Authorization).not.toBe(`Bearer ${rs256}`);
  });

  it('exchanges an RS256-shaped token for a trex-native one via /trex-token', async () => {
    const rs256 = fakeJwt({ aud: 'https://alp-default', exp: future() });
    const exchanged = fakeJwt({ aud: 'authenticated', exp: future() });
    setAuthToken(rs256);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: exchanged }) });
    vi.stubGlobal('fetch', fetchMock);
    await ensureAuthToken();
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${exchanged}` });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/trex-token$/);
    expect(init).toMatchObject({ method: 'POST', headers: { Authorization: `Bearer ${rs256}` } });
  });

  it('skips the exchange when the token already carries aud "authenticated"', async () => {
    const trexNative = fakeJwt({ aud: 'authenticated', exp: future() });
    setAuthToken(trexNative);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await ensureAuthToken();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${trexNative}` });
  });

  it('falls back to the original token when the exchange fails', async () => {
    const rs256 = fakeJwt({ aud: 'https://alp-default', exp: future() });
    setAuthToken(rs256);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await ensureAuthToken();
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${rs256}` });
  });
});
