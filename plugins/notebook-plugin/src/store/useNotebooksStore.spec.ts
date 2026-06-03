import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useNotebooksStore } from "./useNotebooksStore";

const request = vi.fn();
vi.mock("../api/graphqlClient", () => ({
  defaultGraphqlEndpoint: () => "http://x/trex/graphql",
  GraphqlClient: class {
    request = request;
  },
}));

const emptyContent = { metadata: {}, cells: [] };

describe("useNotebooksStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetch lists non-deleted notebooks ordered by updatedAt desc (soft-deleted dropped client-side)", async () => {
    request.mockResolvedValue({
      allNotebookDocuments: {
        nodes: [
          { rowId: "n1", name: "A", description: "", createdAt: "t", updatedAt: "t", deletedAt: null },
          { rowId: "n2", name: "B", description: "", createdAt: "t", updatedAt: "t", deletedAt: "2026-06-01T00:00:00Z" },
        ],
      },
    });
    const s = useNotebooksStore();
    await s.fetch();
    expect(s.notebooks).toHaveLength(1);
    expect(s.notebooks[0].rowId).toBe("n1");
    const q = request.mock.calls[0][0];
    expect(q).toContain("allNotebookDocuments");
    expect(q).toContain("UPDATED_AT_DESC");
  });

  it("fetch records an error on failure", async () => {
    request.mockRejectedValue(new Error("boom"));
    const s = useNotebooksStore();
    await s.fetch();
    expect(s.error).toBe("boom");
    expect(s.notebooks).toHaveLength(0);
  });

  it("get fetches one notebook with its content via condition rowId", async () => {
    request.mockResolvedValue({
      allNotebookDocuments: {
        nodes: [{ rowId: "n1", name: "A", description: "", content: emptyContent, createdAt: "t", updatedAt: "t", deletedAt: null }],
      },
    });
    const s = useNotebooksStore();
    const doc = await s.get("n1");
    expect(doc.rowId).toBe("n1");
    expect(doc.content).toEqual(emptyContent);
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("condition");
    expect(vars.id).toBe("n1");
  });

  it("create sends a createNotebookDocument mutation and returns the new rowId", async () => {
    request
      .mockResolvedValueOnce({ createNotebookDocument: { notebookDocument: { rowId: "new1" } } })
      .mockResolvedValueOnce({ allNotebookDocuments: { nodes: [] } });
    const s = useNotebooksStore();
    const id = await s.create({ name: "My nb", description: "d", content: emptyContent, createdBy: "u1" });
    expect(id).toBe("new1");
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("createNotebookDocument");
    expect((vars.input as any).notebookDocument.name).toBe("My nb");
    expect((vars.input as any).notebookDocument.createdBy).toBe("u1");
  });

  it("update patches name/content and stamps updatedAt", async () => {
    request.mockResolvedValue({ updateNotebookDocumentByRowId: { notebookDocument: { rowId: "n1" } } });
    const s = useNotebooksStore();
    await s.update("n1", { name: "Renamed", content: emptyContent });
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("updateNotebookDocumentByRowId");
    expect(q).toContain("notebookDocumentPatch");
    expect(vars.id).toBe("n1");
    expect((vars.patch as any).name).toBe("Renamed");
    expect(typeof (vars.patch as any).updatedAt).toBe("string");
  });

  it("remove sends a soft-delete patch with an ISO timestamp then refetches", async () => {
    request
      .mockResolvedValueOnce({ updateNotebookDocumentByRowId: { notebookDocument: { rowId: "n1" } } })
      .mockResolvedValueOnce({ allNotebookDocuments: { nodes: [] } });
    const s = useNotebooksStore();
    await s.remove("n1");
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("updateNotebookDocumentByRowId");
    expect((vars.patch as any).deletedAt).toBeTruthy();
    expect(() => new Date((vars.patch as any).deletedAt).toISOString()).not.toThrow();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("duplicate fetches the source then creates a copy named '<name> (copy)'", async () => {
    request
      .mockResolvedValueOnce({ allNotebookDocuments: { nodes: [{ rowId: "n1", name: "Orig", description: "d", content: emptyContent, createdAt: "t", updatedAt: "t", deletedAt: null }] } })
      .mockResolvedValueOnce({ createNotebookDocument: { notebookDocument: { rowId: "copy1" } } });
    const s = useNotebooksStore();
    const id = await s.duplicate("n1");
    expect(id).toBe("copy1");
    const createVars = request.mock.calls[1][1];
    expect((createVars.input as any).notebookDocument.name).toBe("Orig (copy)");
  });
});
