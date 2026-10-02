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
import CreateNotebookDialog from "./CreateNotebookDialog.vue";
import SyncFromRemoteButton from "./SyncFromRemoteButton.vue";
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

  it("shows the Sync from Remote button but disables it", async () => {
    // Shown, not hidden: git is configured on the setup page, so the control
    // has to stay discoverable and read as "not configured yet".
    const w = mount(NotebookHeader, {
      props: { notebooks, activeId: "n1", canSave: true },
    });
    await flushPromises();
    const sync = w
      .findAll("button")
      .find((b) => b.text().includes("Sync from Remote"));
    expect(sync).toBeDefined();
    expect(sync!.attributes("disabled")).toBeDefined();
    // the rest of the header is unaffected
    const labels = w.findAll("button").map((b) => b.text());
    expect(labels).toEqual(expect.arrayContaining(["Export", "Import", "New", "Save"]));
  });

  it("does not call the git API when the disabled Sync button is clicked", async () => {
    const { checkRemoteDiff } = await import("../api/notebookGit");
    const w = mount(SyncFromRemoteButton, { props: { notebookId: "n1" } });
    await w.find("button").trigger("click");
    await flushPromises();
    expect(checkRemoteDiff).not.toHaveBeenCalled();
  });

  it("still fetches templates, which do not depend on mirroring", async () => {
    // Templates only READ a public server-configured repo; turning mirroring
    // off must not take the template list with it.
    const { getTemplates } = await import("../api/notebookGit");
    mount(CreateNotebookDialog, { props: { open: true, existingNames: [] } });
    await flushPromises();
    expect(getTemplates).toHaveBeenCalled();
  });
});
