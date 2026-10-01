// Bearer token for the network-api and hades-api calls, read from the host on
// every request so a token the host refreshes is picked up. Those endpoints
// validate the host IdP token directly, so it is sent unchanged — never the
// trex-native token minted by /trex-token, which they reject.
let source: () => string | null = () => null;

export function setAuthTokenSource(get: () => string | null): void {
  source = get;
}

export function setAuthToken(t: string | null): void {
  source = () => t;
}

export function getAuthToken(): string | null {
  return source() ?? null;
}

export function authHeaders(): Record<string, string> {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
