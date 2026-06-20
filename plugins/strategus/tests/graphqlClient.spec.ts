import { describe, it, expect, vi } from 'vitest';
import { GraphqlClient } from '../src/api/graphqlClient';
import { setAuthToken } from '../src/api/authToken';

describe('strategus GraphqlClient', () => {
  it('POSTs query+variables to /trex/graphql and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { allNotebookAnalysisDefinitions: { nodes: [{ rowId: 'd1' }] } },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const c = new GraphqlClient('http://x/trex/graphql');
    const data = await c.request<{
      allNotebookAnalysisDefinitions: { nodes: { rowId: string }[] };
    }>('query { allNotebookAnalysisDefinitions { nodes { rowId } } }', {});
    expect(data.allNotebookAnalysisDefinitions.nodes[0].rowId).toBe('d1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://x/trex/graphql');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBeUndefined();
  });

  it('throws on GraphQL errors array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ errors: [{ message: 'boom' }] }),
      })
    );
    const c = new GraphqlClient('http://x/trex/graphql');
    await expect(c.request('query{x}', {})).rejects.toThrow('boom');
  });
});
