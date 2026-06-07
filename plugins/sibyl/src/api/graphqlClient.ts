export class GraphqlClient {
  constructor(private endpoint: string) {}

  async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const resp = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    if (!resp.ok) throw new Error(`graphql request failed: ${resp.status}`)
    const body = (await resp.json()) as { data?: T; errors?: Array<{ message: string }> }
    if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join('; '))
    return body.data as T
  }
}

export const defaultGraphqlEndpoint = () => `${location.origin}/trex/graphql`
