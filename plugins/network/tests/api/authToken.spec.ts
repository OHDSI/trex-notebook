import { describe, it, expect } from 'vitest';
import { setAuthToken, getAuthToken, authHeaders } from '../../src/api/authToken';

describe('authToken', () => {
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
});
