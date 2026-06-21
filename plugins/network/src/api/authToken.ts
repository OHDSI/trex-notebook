// Shared auth token for backend calls. Set by main.ts from the host's
// authContext on mount; read by ApiClient + HadesClient. Replaces the
// () => null stub — Atlas3 provides a Bearer token instead.
let token: string | null = null;
export function setAuthToken(t: string | null): void { token = t; }
export function getAuthToken(): string | null { return token; }
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
