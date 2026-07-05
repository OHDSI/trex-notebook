// Minimal GraphQL client for trex's auto-generated PostGraphile endpoint.
// Sends Authorization: Bearer <token> (set via setAuthToken from main.ts);
// throws on a GraphQL `errors[]` payload. Mirrors the jobs plugin's
// graphqlClient so the two stay interchangeable.
import { authHeaders } from './authToken';

export class GraphqlClient {
  constructor(private endpoint: string) {}

  async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const resp = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ query, variables }),
    });
    if (!resp.ok) throw new Error(`graphql ${resp.status}`);
    const body = await resp.json();
    if (body.errors?.length) {
      throw new Error(body.errors.map((e: { message: string }) => e.message).join('; '));
    }
    return body.data as T;
  }
}

export const defaultGraphqlEndpoint = (): string => `${location.origin}/trex/graphql`;
