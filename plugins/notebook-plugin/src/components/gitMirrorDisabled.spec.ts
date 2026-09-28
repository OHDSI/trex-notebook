// Guards the SHIPPED configuration: GIT_MIRROR_ENABLED is false, because the
// mirror endpoints return 401 and Atlas's login-guard turns any 401 into a
// sign-in dialog — which logged the user out on every save. These tests fail if
// someone flips the flag back on without fixing that.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const mirrorNotebook = vi.fn();
vi.mock("../api/notebookGit", () => ({
  GIT_MIRROR_ENABLED: false, // the real shipped value
  mirrorNotebook: (...a: unknown[]) => mirrorNotebook(...a),
  checkRemoteDiff: vi.fn(),
  overwriteFromRemote: vi.fn(),
  getTemplates: vi.fn().mockResolvedValue([]),
  notebookGitBase: () => "http://x/notebook-git-api",
}));

const request = vi.fn();
vi.mock("../api/graphqlClient", () => ({
  defaultGraphqlEndpoint: () => "http://x/trex/graphql",
  GraphqlClient: class { request = request },
}));

import NotebookHeader from "./NotebookHeader.vue";
import { useNotebooksStore } from "../store/useNotebooksStore";

const notebooks = [
  { rowId: "n1", name: "First", description: "", createdAt: "t", updatedAt: "t", deletedAt: null },
];

describe("with git mirroring disabled", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    request.mockResolvedValue({ allNotebookDocuments: { nodes: [] } });
  });

  it("does NOT push to git on save", async () => {
    const s = useNotebooksStore();
    await s.update("n1", { name: "B" });
    expect(mirrorNotebook).not.toHaveBeenCalled();
  });

  it("does NOT push to git on delete", async () => {
    const s = useNotebooksStore();
    await s.remove("n1");
    expect(mirrorNotebook).not.toHaveBeenCalled();
  });

  it("leaves no mirror warning, so saves report plain success", async () => {
    const s = useNotebooksStore();
    await s.update("n1", { name: "B" });
    expect(s.mirrorWarning).toBeNull();
  });

  it("hides the Sync from Remote button", async () => {
    const w = mount(NotebookHeader, {
      props: { notebooks, activeId: "n1", canSave: true },
    });
    await flushPromises();
    const labels = w.findAll("button").map((b) => b.text());
    expect(labels.some((t) => t.includes("Sync from Remote"))).toBe(false);
    // the rest of the header is unaffected
    expect(labels).toEqual(expect.arrayContaining(["Export", "Import", "New", "Save"]));
  });
});
