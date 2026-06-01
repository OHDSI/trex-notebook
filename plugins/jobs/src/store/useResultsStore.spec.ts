import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useResultsStore } from "./useResultsStore";

const request = vi.fn();
vi.mock("../api/graphqlClient", () => ({
  defaultGraphqlEndpoint: () => "http://x/trex/graphql",
  GraphqlClient: class {
    request = request;
  },
}));

describe("useResultsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetch lists results (schema-prefixed) sorted by createdAt desc client-side", async () => {
    request.mockResolvedValue({
      allNotebookAnalysisResults: {
        nodes: [
          { rowId: "r1", jobId: "j1", createdAt: "2026-06-01T00:00:00Z" },
          { rowId: "r2", jobId: "j2", createdAt: "2026-06-02T00:00:00Z" },
        ],
      },
    });
    const s = useResultsStore();
    await s.fetch();
    expect(s.results).toHaveLength(2);
    expect(s.results[0].rowId).toBe("r2"); // newest first
    expect(request.mock.calls[0][0]).toContain("allNotebookAnalysisResults");
  });

  it("fetch records an error on failure", async () => {
    request.mockRejectedValue(new Error("nope"));
    const s = useResultsStore();
    await s.fetch();
    expect(s.error).toBe("nope");
  });
});
