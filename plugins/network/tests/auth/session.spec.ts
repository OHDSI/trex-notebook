import { describe, it, expect, beforeEach } from 'vitest';
import { storeTokens, getToken, isAuthenticated, logout } from '../../src/auth/session';

beforeEach(() => localStorage.clear());

describe('session', () => {
  it('is unauthenticated by default', () => {
    expect(isAuthenticated()).toBe(false);
  });
  it('stores a token and reports it until expiry', () => {
    storeTokens({ access_token: 'at', id_token: 'it', expires_in: 3600 }, () => 1000);
    expect(getToken(() => 1000)).toBe('at');
  });
  it('expires the token', () => {
    storeTokens({ access_token: 'at', id_token: 'it', expires_in: 1 }, () => 1000);
    expect(getToken(() => 1_003_000)).toBeNull();
  });
  it('logout clears it', () => {
    storeTokens({ access_token: 'at', id_token: 'it', expires_in: 3600 }, () => 1000);
    logout();
    expect(getToken(() => 1000)).toBeNull();
  });
});
