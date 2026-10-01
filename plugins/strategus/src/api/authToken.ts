// Shared auth token for backend calls. Set by main.ts from the host's
// authContext on mount; read by graphqlClient + hadesClient. Replaces the
// sibyl session-cookie assumption — Atlas3 provides a Bearer token instead.
//
// Under a d2e/Atlas host the token is a Logto RS256 access token, which trex
// core's HS256-only auth middleware rejects — requests would run as the
// grant-less `anon` Postgres role. ensureAuthToken() exchanges it via the
// /trex-token function for a trex-native token before it is sent. Tokens that
// already carry aud "authenticated" are trex-native and are sent unchanged.
let source: () => string | null = () => null;
let exchangedFor: string | null = null;
let trexToken: string | null = null;
let exchange: Promise<string | null> | null = null;

/** Reads the host token on every request, so a token the host refreshes is picked up. */
export function setAuthTokenSource(get: () => string | null): void {
  source = get;
  exchangedFor = null;
  trexToken = null;
  exchange = null;
}

export function setAuthToken(t: string | null): void {
  setAuthTokenSource(() => t);
}

function hostToken(): string | null {
  const t = source() ?? null;
  if (t !== exchangedFor) {
    exchangedFor = t;
    trexToken = null;
    exchange = null;
  }
  return t;
}

function jwtPayload(t: string): Record<string, unknown> | null {
  try {
    const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function expiresSoon(t: string): boolean {
  const exp = jwtPayload(t)?.exp;
  return typeof exp === 'number' && exp * 1000 < Date.now() + 30_000;
}

async function exchangeToken(t: string): Promise<string | null> {
  try {
    const resp = await fetch(`${location.origin}/trex-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    return typeof body.access_token === 'string' ? body.access_token : null;
  } catch {
    return null;
  }
}

/** Resolve the token authHeaders() will send; await before any backend request. */
export async function ensureAuthToken(): Promise<void> {
  const token = hostToken();
  if (!token) return;
  const payload = jwtPayload(token);
  if (!payload || payload.aud === 'authenticated') return;
  if (trexToken && !expiresSoon(trexToken)) return;
  if (!exchange) {
    exchange = exchangeToken(token).finally(() => {
      exchange = null;
    });
  }
  const p = exchange;
  const exchanged = await p;
  if (exchangedFor === token) trexToken = exchanged ?? trexToken;
}

export function authHeaders(): Record<string, string> {
  const host = hostToken();
  const t = trexToken ?? host;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * Headers carrying the host-provided token without the trex exchange.
 * The /WebAPI, network-api and hades-api routes validate the host's OIDC token
 * and reject trex-native (HS256) tokens — the inverse of the trex core
 * endpoints above.
 */
export function hostAuthHeaders(): Record<string, string> {
  const token = hostToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
