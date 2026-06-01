import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useConnectionsStore } from "./useConnectionsStore";

const request = vi.fn();
vi.mock("../api/graphqlClient", () => ({
  defaultGraphqlEndpoint: () => "http://x/trex/graphql",
  GraphqlClient: class {
    request = request;
  },
}));

describe("useConnectionsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetch lists connections (schema-prefixed, sorted by label client-side)", async () => {
    request.mockResolvedValue({
      allNotebookCdmConnections: {
        nodes: [
          { rowId: "c2", label: "Zeta" },
          { rowId: "c1", label: "Alpha" },
        ],
      },
    });
    const s = useConnectionsStore();
    await s.fetch();
    expect(s.connections).toHaveLength(2);
    expect(s.connections[0].label).toBe("Alpha");
    expect(request.mock.calls[0][0]).toContain("allNotebookCdmConnections");
  });

  it("create sends createNotebookCdmConnection with the notebookCdmConnection input", async () => {
    request.mockResolvedValue({ createNotebookCdmConnection: { notebookCdmConnection: { rowId: "c1" } } });
    const s = useConnectionsStore();
    await s.create({ label: "A", host: "h", database: "db", cdmSchema: "cdm", user: "u" });
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("createNotebookCdmConnection");
    expect(q).toContain("notebookCdmConnection");
    expect(vars.c.label).toBe("A");
  });

  it("update sends updateNotebookCdmConnectionByRowId with rowId + patch", async () => {
    request.mockResolvedValue({ updateNotebookCdmConnectionByRowId: { notebookCdmConnection: { rowId: "c1" } } });
    const s = useConnectionsStore();
    await s.update("c1", { host: "newhost" });
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("updateNotebookCdmConnectionByRowId");
    expect(q).toContain("notebookCdmConnectionPatch");
    expect(vars.id).toBe("c1");
    expect(vars.p.host).toBe("newhost");
  });

  it("remove sends deleteNotebookCdmConnectionByRowId with rowId", async () => {
    request.mockResolvedValue({ deleteNotebookCdmConnectionByRowId: { deletedNotebookCdmConnectionId: "x" } });
    const s = useConnectionsStore();
    await s.remove("c1");
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain("deleteNotebookCdmConnectionByRowId");
    expect(vars.id).toBe("c1");
  });
});
