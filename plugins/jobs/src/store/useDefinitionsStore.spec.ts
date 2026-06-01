import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDefinitionsStore } from "./useDefinitionsStore";

const request = vi.fn();
vi.mock("../api/graphqlClient", () => ({
  defaultGraphqlEndpoint: () => "http://x/trex/graphql",
  GraphqlClient: class {
    request = request;
  },
}));

describe("useDefinitionsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetch lists non-deleted definitions (dropping soft-deleted client-side)", async () => {
    request.mockResolvedValue({
      allNotebookAnalysisDefinitions: {
        nodes: [
          { rowId: "d1", name: "A", deletedAt: null },
          { rowId: "d2", name: "B", deletedAt: "2026-06-01T00:00:00Z" },
        ],
      },
    });
    const s = useDefinitionsStore();
    await s.fetch();
    expect(s.definitions).toHaveLength(1);
    expect(s.definitions[0].rowId).toBe("d1");
    // Uses the schema-PREFIXED list query with UPDATED_AT_DESC.
    const q = request.mock.calls[0][0];
    expect(q).toContain("allNotebookAnalysisDefinitions");
    expect(q).toContain("UPDATED_AT_DESC");
  });

  it("fetch records an error on failure", async () => {
    request.mockRejectedValue(new Error("boom"));
    const s = useDefinitionsStore();
    await s.fetch();
    expect(s.error).toBe("boom");
    expect(s.definitions).toHaveLength(0);
  });

  it("get fetches one definition with its spec via condition rowId", async () => {
    request.mockResolvedValue({
      allNotebookAnalysisDefinitions: {
        nodes: [{ rowId: "d1", name: "A", description: "", spec: { foo: 1 } }],
      },
    });
    const s = useDefinitionsStore();
    const def = await s.get("d1");
    expect(def.rowId).toBe("d1");
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("allNotebookAnalysisDefinitions");
    expect(q).toContain("condition");
    expect(vars.id).toBe("d1");
  });

  it("remove sends a schema-prefixed soft-delete patch with an ISO timestamp", async () => {
    request.mockResolvedValue({
      updateNotebookAnalysisDefinitionByRowId: { notebookAnalysisDefinition: { rowId: "d1" } },
    });
    const s = useDefinitionsStore();
    await s.remove("d1");
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("updateNotebookAnalysisDefinitionByRowId");
    expect(q).toContain("notebookAnalysisDefinitionPatch");
    expect(vars.id).toBe("d1");
    expect(typeof vars.ts).toBe("string");
    // ISO timestamp string.
    expect(() => new Date(vars.ts as string).toISOString()).not.toThrow();
  });
});
