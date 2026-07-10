// Shared auth token for backend calls. Set by main.ts from the host's
// authContext on mount; read by graphqlClient + hadesClient. Replaces the
// sibyl session-cookie assumption — Atlas3 provides a Bearer token instead.
//
// Under a d2e/Atlas host the token is a Logto RS256 access token, which trex
// core's HS256-only auth middleware rejects — requests would run as the
// grant-less `anon` Postgres role. ensureAuthToken() exchanges it via the
// /trex-token function for a trex-native token before it is sent. Tokens that
// already carry aud "authenticated" are trex-native and are sent unchanged.
let token: string | null = null;
let trexToken: string | null = null;
let exchange: Promise<string | null> | null = null;

export function setAuthToken(t: string | null): void {
  token = t;
  trexToken = null;
  exchange = null;
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
  trexToken = (await p) ?? trexToken;
}

export function getAuthToken(): string | null {
  return trexToken ?? token;
}

export function authHeaders(): Record<string, string> {
  const t = trexToken ?? token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}
