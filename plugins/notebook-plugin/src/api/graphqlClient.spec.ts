import { describe, it, expect, vi } from "vitest";
import { GraphqlClient, defaultGraphqlEndpoint } from "./graphqlClient";

describe("GraphqlClient", () => {
  it("POSTs query+variables to the endpoint with credentials and returns data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { allNotebookDocuments: { nodes: [{ rowId: "n1" }] } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const c = new GraphqlClient("http://x/trex/graphql");
    const data = await c.request<{ allNotebookDocuments: { nodes: { rowId: string }[] } }>(
      "query { allNotebookDocuments { nodes { rowId } } }", {});
    expect(data.allNotebookDocuments.nodes[0].rowId).toBe("n1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/trex/graphql");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
  });

  it("throws on a GraphQL errors array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ errors: [{ message: "boom" }] }),
    }));
    const c = new GraphqlClient("http://x/trex/graphql");
    await expect(c.request("query{x}", {})).rejects.toThrow("boom");
  });

  it("defaultGraphqlEndpoint targets /trex/graphql on the current origin", () => {
    expect(defaultGraphqlEndpoint().endsWith("/trex/graphql")).toBe(true);
  });
});
