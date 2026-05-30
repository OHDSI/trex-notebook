import { loadConfig } from '../config';
import { randomVerifier, challengeFromVerifier, buildAuthorizeUrl } from './pkce';

const TOKEN_KEY = 'network.plugin.tokens';
const VERIFIER_KEY = 'network.plugin.pkce.verifier';
const STATE_KEY = 'network.plugin.pkce.state';

interface TokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
}
interface StoredTokens {
  accessToken: string;
  expiresAtMs: number;
}

const nowMs = () => Date.now();

export function storeTokens(t: TokenResponse, now: () => number = nowMs): void {
  const stored: StoredTokens = {
    accessToken: t.access_token,
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
  if (!t || now() >= t.expiresAtMs) return null;
  return t.accessToken;
}

export function isAuthenticated(now: () => number = nowMs): boolean {
  return getToken(now) !== null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(): Promise<void> {
  const cfg = loadConfig();
  const verifier = randomVerifier();
  const state = randomVerifier().slice(0, 16);
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);
  const challenge = await challengeFromVerifier(verifier);
  location.assign(
    buildAuthorizeUrl({
      domain: cfg.cognitoDomain,
      clientId: cfg.clientId,
      redirectUri: cfg.redirectUri,
      challenge,
      state,
    }),
  );
}

export async function handleCallback(search: string): Promise<void> {
  const cfg = loadConfig();
  const params = new URLSearchParams(search);
  const code = params.get('code');
  if (!code) throw new Error('missing authorization code');
  if (params.get('state') !== localStorage.getItem(STATE_KEY)) throw new Error('state mismatch');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cfg.clientId,
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: localStorage.getItem(VERIFIER_KEY) ?? '',
  });
  const res = await fetch(`${cfg.cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('token exchange failed');
  storeTokens((await res.json()) as TokenResponse);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
}
