// Minimal GraphQL client for trex's auto-generated PostGraphile endpoint.
// Same-origin POST with the session cookie (credentials: "include"); throws on
// a GraphQL `errors[]` payload. Mirrors the jobs plugin's graphqlClient so the
// two stay interchangeable.
export class GraphqlClient {
  constructor(private endpoint: string) {}

  async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const resp = await fetch(this.endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
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
