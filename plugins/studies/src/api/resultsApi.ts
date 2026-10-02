// Client for the strategus-analysis function's results API
// (d2e-dev-santan: plugins/functions/strategus-analysis/src/results/routes.ts),
// mounted at the gateway root as /strategus/results.
//
// The d2eAuthn middleware on this endpoint verifies an RS256 bearer token
// (either Logto or trex-OIDC depending on D2E_IDP). The Atlas host stores this
// token in localStorage['bearerToken'] via the token-keeper.js script. When the
// key is absent or near expiry we replicate token-keeper's on-demand refresh
// (atlas_oidc_cfg + atlas_refresh_token → POST tokenEndpoint).

const RESULTS_URL = () => `${location.origin}/strategus/results`;

const TOKEN_KEY = 'bearerToken';
const RT_KEY = 'atlas_refresh_token';
const CFG_KEY = 'atlas_oidc_cfg';
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh when <5 min remain

let refreshing: Promise<string | null> | null = null;

function decodeExp(jwt: string): number {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(payload)) as Record<string, unknown>;
    return typeof parsed.exp === 'number' ? parsed.exp : 0;
  } catch {
    return 0;
  }
}

function isExpiringSoon(jwt: string): boolean {
  const exp = decodeExp(jwt);
  return exp === 0 || exp * 1000 - Date.now() < REFRESH_BEFORE_MS;
}

async function doRefresh(): Promise<string | null> {
  const rt = localStorage.getItem(RT_KEY);
  const cfgRaw = localStorage.getItem(CFG_KEY);
  if (!rt || !cfgRaw) return null;
  let cfg: Record<string, string>;
  try {
    cfg = JSON.parse(cfgRaw) as Record<string, string>;
  } catch {
    return null;
  }
  if (!cfg.tokenEndpoint || !cfg.clientId) return null;

  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', rt);
  body.set('client_id', cfg.clientId);
  if (cfg.resource) body.set('resource', cfg.resource);

  try {
    const resp = await fetch(cfg.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      localStorage.removeItem(RT_KEY);
      return null;
    }
    const data = await resp.json() as Record<string, unknown>;
    const token = typeof data.access_token === 'string' ? data.access_token : null;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (typeof data.refresh_token === 'string') localStorage.setItem(RT_KEY, data.refresh_token);
    return token;
  } catch {
    return null;
  }
}

async function getToken(): Promise<string | null> {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored && !isExpiringSoon(stored)) return stored;

  // Deduplicate concurrent refresh calls
  if (!refreshing) {
    refreshing = doRefresh().finally(() => { refreshing = null; });
  }
  const refreshed = await refreshing;
  if (refreshed) return refreshed;

  // Refresh failed (network blip, revoked refresh token, bad config), but the
  // stored token was only "expiring soon", not actually expired yet — use it
  // rather than sending no Authorization header at all and guaranteeing a 401.
  if (stored && decodeExp(stored) * 1000 > Date.now()) return stored;
  return null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface BackendResult {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

export async function listBackendResults(): Promise<BackendResult[]> {
  const res = await fetch(RESULTS_URL(), { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Failed to list results: ${res.status}`);
  return await res.json();
}

export async function downloadBackendResult(id: string): Promise<Blob> {
  const res = await fetch(`${RESULTS_URL()}/${encodeURIComponent(id)}/download`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to download result: ${res.status}`);
  return await res.blob();
}
