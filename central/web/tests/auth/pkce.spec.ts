import { describe, it, expect } from 'vitest';
import {
  randomVerifier,
  challengeFromVerifier,
  buildAuthorizeUrl,
} from '../../src/auth/pkce';

describe('pkce', () => {
  it('randomVerifier returns a url-safe string of adequate length', () => {
    const v = randomVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v).toMatch(/^[A-Za-z0-9._~-]+$/);
  });

  it('challengeFromVerifier produces a base64url SHA-256 (no padding)', async () => {
    const c = await challengeFromVerifier('test-verifier');
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(c).not.toContain('=');
  });

  it('buildAuthorizeUrl includes required OAuth params', () => {
    const url = new URL(
      buildAuthorizeUrl({
        domain: 'https://d.auth',
        clientId: 'cid',
        redirectUri: 'https://app/callback',
        challenge: 'chal',
        state: 'st8',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://d.auth/oauth2/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('code_challenge')).toBe('chal');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('st8');
    expect(url.searchParams.get('scope')).toContain('openid');
  });
});
