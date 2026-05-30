import { config } from '../config';
import { randomVerifier, challengeFromVerifier, buildAuthorizeUrl } from './pkce';

const TOKEN_KEY = 'central.web.tokens';
const VERIFIER_KEY = 'central.web.pkce.verifier';
const STATE_KEY = 'central.web.pkce.state';

interface TokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
}
interface StoredTokens {
  accessToken: string;
  idToken: string;
  expiresAtMs: number;
}

const nowMs = () => Date.now();

export function storeTokens(t: TokenResponse, now: () => number = nowMs): void {
  const stored: StoredTokens = {
    accessToken: t.access_token,
    idToken: t.id_token,
    expiresAtMs: now() * 1 + t.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
}

function read(): StoredTokens | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function getToken(now: () => number = nowMs): string | null {
  const t = read();
  if (!t) return null;
  if (now() >= t.expiresAtMs) return null;
  return t.accessToken;
}

export function isAuthenticated(now: () => number = nowMs): boolean {
  return getToken(now) !== null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(): Promise<void> {
  const verifier = randomVerifier();
  const state = randomVerifier().slice(0, 16);
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);
  const challenge = await challengeFromVerifier(verifier);
  location.assign(
    buildAuthorizeUrl({
      domain: config.cognitoDomain,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      challenge,
      state,
    }),
  );
}

export async function handleCallback(search: string): Promise<void> {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) throw new Error('missing authorization code');
  if (state !== localStorage.getItem(STATE_KEY)) throw new Error('state mismatch');

  const verifier = localStorage.getItem(VERIFIER_KEY) ?? '';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });
  const res = await fetch(`${config.cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('token exchange failed');
  storeTokens((await res.json()) as TokenResponse);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
}
