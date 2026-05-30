import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isAuthenticated, getToken, storeTokens, logout } from '../../src/auth/session';

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('session token storage', () => {
  it('isAuthenticated is false with no token', () => {
    expect(isAuthenticated()).toBe(false);
    expect(getToken()).toBeNull();
  });

  it('stores tokens and reports authenticated until expiry', () => {
    storeTokens({ access_token: 'at', id_token: 'it', expires_in: 3600 }, () => 1000);
    expect(getToken(() => 1000)).toBe('at');
    expect(isAuthenticated(() => 1000)).toBe(true);
  });

  it('treats an expired token as unauthenticated', () => {
    storeTokens({ access_token: 'at', id_token: 'it', expires_in: 1 }, () => 1000);
    // now() far in the future (ms): 1000s + 2s
    expect(isAuthenticated(() => 1_003_000)).toBe(false);
    expect(getToken(() => 1_003_000)).toBeNull();
  });

  it('logout clears the token', () => {
    storeTokens({ access_token: 'at', id_token: 'it', expires_in: 3600 }, () => 1000);
    logout();
    expect(getToken(() => 1000)).toBeNull();
  });
});
