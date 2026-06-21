import { describe, it, expect } from 'vitest';
import { setAuthToken, authHeaders } from '../src/api/authToken';

describe('authToken', () => {
  it('returns no Authorization header when unset', () => {
    setAuthToken(null);
    expect(authHeaders()).toEqual({});
  });
  it('returns a Bearer header when set', () => {
    setAuthToken('abc123');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer abc123' });
  });
});
