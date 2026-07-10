// Direct OHDSI WebAPI fallback for hosts whose messageBus does not serve the
// 'data:request' cohorts resource. The /WebAPI routes validate the host's own
// OIDC token (hostAuthHeaders); the trex-exchanged token is only tried as a
// fallback for hosts wired the other way around.
import { ensureAuthToken, authHeaders, hostAuthHeaders } from './authToken';

export interface WebApiCohortListItem {
  id: number;
  name: string;
  description?: string;
}

async function webapiFetch(path: string): Promise<Response> {
  let resp = await fetch(`${location.origin}${path}`, { headers: hostAuthHeaders() });
  if (resp.status === 401 || resp.status === 403) {
    await ensureAuthToken();
    resp = await fetch(`${location.origin}${path}`, { headers: authHeaders() });
  }
  return resp;
}

export async function fetchCohortDefinitionList(): Promise<WebApiCohortListItem[]> {
  const resp = await webapiFetch('/WebAPI/cohortdefinition');
  if (!resp.ok) {
    throw new Error(`WebAPI cohort definition list failed: ${resp.status}`);
  }
  const body: unknown = await resp.json();
  if (!Array.isArray(body)) {
    throw new Error('WebAPI cohort definition list: unexpected response shape');
  }
  return body.filter(
    (item): item is WebApiCohortListItem =>
      typeof item === 'object' && item !== null &&
      typeof (item as { id?: unknown }).id === 'number' &&
      typeof (item as { name?: unknown }).name === 'string'
  );
}

/** Fetch a cohort definition's Circe expression as a JSON string. */
export async function fetchCohortDefinitionExpression(id: number): Promise<string> {
  const resp = await webapiFetch(`/WebAPI/cohortdefinition/${id}`);
  if (!resp.ok) {
    throw new Error(`WebAPI cohort definition ${id} failed: ${resp.status}`);
  }
  const body: unknown = await resp.json();
  const expression = (body as { expression?: unknown })?.expression;
  if (typeof expression === 'string' && expression.trim()) return expression;
  if (expression && typeof expression === 'object') return JSON.stringify(expression);
  throw new Error(`WebAPI cohort definition ${id} has no expression`);
}
