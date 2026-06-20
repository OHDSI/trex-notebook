// Shared auth token for backend calls. Set by main.ts from the host's
// authContext on mount; read by graphqlClient. Replaces the
// sibyl session-cookie assumption — Atlas3 provides a Bearer token instead.
let token: string | null = null;
export function setAuthToken(t: string | null): void { token = t; }
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
