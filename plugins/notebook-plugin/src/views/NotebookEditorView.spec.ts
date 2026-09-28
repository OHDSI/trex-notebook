import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const setNotebookData = vi.fn();
vi.mock("@trex/notebook", () => ({
  Notebook: {
    name: "Notebook",
    props: ["data", "initialData", "kernels", "kernelConfigs", "showToolbar", "showLineNumbers", "showKernelSelector", "theme", "onChange"],
    setup(_p: unknown, { expose }: { expose: (o: unknown) => void }) {
      expose({ setNotebookData });
      return () => null;
    },
  },
  PyodideKernel: class { disconnect = vi.fn().mockResolvedValue(undefined) },
  WebRKernel: class { disconnect = vi.fn().mockResolvedValue(undefined) },
  createEmptyNotebook: () => ({ cells: [], metadata: {} }),
  serializeIpynb: (d: unknown) => JSON.stringify(d),
  parseIpynb: (t: string) => JSON.parse(t),
}));

const storeApi = {
  notebooks: [
    { rowId: "n1", name: "First", description: "d1", createdAt: "t", updatedAt: "t", deletedAt: null },
    { rowId: "n2", name: "Second", description: "d2", createdAt: "t", updatedAt: "t", deletedAt: null },
  ],
  error: null,
  mirrorWarning: null as string | null,
  fetch: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  create: vi.fn().mockResolvedValue("n3"),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  duplicate: vi.fn(),
};
vi.mock("../store/useNotebooksStore", () => ({
  useNotebooksStore: () => storeApi,
}));

const templateApi = { getTemplates: vi.fn().mockResolvedValue([]) };
vi.mock("../api/notebookGit", () => ({
  GIT_MIRROR_ENABLED: true,
  checkRemoteDiff: vi.fn().mockResolvedValue({ hasDifferences: false, reason: "x" }),
  overwriteFromRemote: vi.fn(),
  mirrorNotebook: vi.fn(),
  getTemplates: (...args: unknown[]) => templateApi.getTemplates(...args),
}));

import NotebookEditorView from "./NotebookEditorView.vue";

const doc = (rowId: string) => ({
  rowId, name: `NB ${rowId}`, description: "d",
  content: { cells: [{ id: "c1" }], metadata: {} },
  createdAt: "t", updatedAt: "t", deletedAt: null,
});

function view(id: string | null = "n1") {
  return mount(NotebookEditorView, { props: { id } });
}

function byLabel(w: ReturnType<typeof mount>, label: string) {
  return w.findAll("button").find((b) => b.text() === label)!;
}

async function selectFile(w: ReturnType<typeof mount>, name: string, content: string) {
  const input = w.find('input[type="file"]');
  const file = new File([content], name, { type: "application/json" });
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  await input.trigger("change");
}

/** Simulates a cell edit by invoking the Notebook stub's onChange prop directly. */
function edit(w: ReturnType<typeof mount>, data: unknown = { cells: [{ id: "c2" }], metadata: {} }) {
  const onChange = w.findComponent({ name: "Notebook" }).props("onChange") as (d: unknown) => void;
  onChange(data);
}

describe("NotebookEditorView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    storeApi.mirrorWarning = null;
    storeApi.get.mockImplementation(async (id: string) => doc(id));
    templateApi.getTemplates.mockResolvedValue([]);
  });

  it("loads the deep-linked notebook on mount", async () => {
    view("n1");
    await flushPromises();
    expect(storeApi.get).toHaveBeenCalledWith("n1");
  });

  it("shows the empty state when opened with no id", async () => {
    const w = view(null);
    await flushPromises();
    expect(w.text()).toContain("Select a notebook to get started");
    expect(storeApi.get).not.toHaveBeenCalled();
  });

  it("pushes new content through setNotebookData when switching notebooks", async () => {
    const w = view("n1");
    await flushPromises();
    setNotebookData.mockClear();
    await w.find("select").setValue("n2");
    await flushPromises();
    expect(storeApi.get).toHaveBeenCalledWith("n2");
    expect(setNotebookData).toHaveBeenCalledWith(doc("n2").content);
  });

  it("saves through the store, which mirrors to git", async () => {
    const w = view("n1");
    await flushPromises();
    await byLabel(w, "Save").trigger("click");
    await flushPromises();
    expect(storeApi.update).toHaveBeenCalledWith("n1", expect.objectContaining({ name: "NB n1" }));
  });

  it("surfaces a mirror warning as a warning, not an error", async () => {
    storeApi.mirrorWarning = "Saved, but not pushed to git: push rejected";
    const w = view("n1");
    await flushPromises();
    await byLabel(w, "Save").trigger("click");
    await flushPromises();
    expect(w.find('[data-severity="warning"]').exists()).toBe(true);
  });

  it("surfaces a mirror warning for a create, not a success", async () => {
    storeApi.mirrorWarning = "Saved, but not pushed to git: push rejected";
    const w = view("n1");
    await flushPromises();
    await byLabel(w, "New").trigger("click");
    await w.find('[role="dialog"] input').setValue("Fresh");
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(w.find('[data-severity="warning"]').exists()).toBe(true);
  });

  it("surfaces a mirror warning for a rename, not a success", async () => {
    storeApi.mirrorWarning = "Saved, but not pushed to git: push rejected";
    const w = view("n1");
    await flushPromises();
    await w.find('[aria-label="Rename"]').trigger("click");
    const inputs = w.findAll('[role="dialog"] input');
    await inputs[0].setValue("Renamed");
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(w.find('[data-severity="warning"]').exists()).toBe(true);
  });

  it("surfaces a mirror warning for a delete, not a success", async () => {
    storeApi.mirrorWarning = "Saved, but not pushed to git: push rejected";
    const w = view("n1");
    await flushPromises();
    await byLabel(w, "Delete").trigger("click");
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(w.find('[data-severity="warning"]').exists()).toBe(true);
  });

  it("surfaces a mirror warning for an import, not a success", async () => {
    storeApi.mirrorWarning = "Saved, but not pushed to git: push rejected";
    const w = view("n1");
    await flushPromises();
    await selectFile(w, "note.ipynb", JSON.stringify({ cells: [], metadata: {} }));
    await flushPromises();
    expect(w.find('[data-severity="warning"]').exists()).toBe(true);
  });

  it("creates a notebook from the dialog and opens it", async () => {
    const w = view("n1");
    await flushPromises();
    await byLabel(w, "New").trigger("click");
    await w.find('[role="dialog"] input').setValue("Fresh");
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(storeApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Fresh" }));
  });

  it("creates a notebook from the chosen template's content and description", async () => {
    templateApi.getTemplates.mockResolvedValue([
      { id: "t1", name: "Template One", description: "T-desc", content: { cells: [{ id: "x" }], metadata: {} } },
    ]);
    const w = view("n1");
    await flushPromises();
    await byLabel(w, "New").trigger("click");
    await flushPromises();
    await w.find('[role="dialog"] input').setValue("Fresh");
    await w.find('[role="dialog"] select').setValue("t1");
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(storeApi.create).toHaveBeenCalledWith({
      name: "Fresh",
      description: "T-desc",
      content: { cells: [{ id: "x" }], metadata: {} },
    });
  });

  it("renames through the details dialog", async () => {
    const w = view("n1");
    await flushPromises();
    await w.find('[aria-label="Rename"]').trigger("click");
    const inputs = w.findAll('[role="dialog"] input');
    await inputs[0].setValue("Renamed");
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(storeApi.update).toHaveBeenCalledWith("n1", expect.objectContaining({ name: "Renamed" }));
  });

  it("deletes only after confirmation", async () => {
    const w = view("n1");
    await flushPromises();
    await byLabel(w, "Delete").trigger("click");
    expect(storeApi.remove).not.toHaveBeenCalled();
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(storeApi.remove).toHaveBeenCalledWith("n1");
  });

  it("emits back for the Studies link", async () => {
    const w = view("n1");
    await flushPromises();
    await w.find(".notebook-editor__back").trigger("click");
    expect(w.emitted("back")).toBeTruthy();
  });

  it("reloads the row after a git sync", async () => {
    const w = view("n1");
    await flushPromises();
    storeApi.get.mockClear();
    w.findComponent({ name: "SyncFromRemoteButton" }).vm.$emit("synced");
    await flushPromises();
    expect(storeApi.get).toHaveBeenCalledWith("n1");
  });

  it("editing a cell shows the unsaved chip", async () => {
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    expect(w.find('[data-tone="warning"]').exists()).toBe(true);
    expect(w.text()).toContain("Unsaved");
  });

  it("a successful save clears the unsaved chip", async () => {
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    expect(w.find('[data-tone="warning"]').exists()).toBe(true);
    await byLabel(w, "Save").trigger("click");
    await flushPromises();
    expect(w.find('[data-tone="warning"]').exists()).toBe(false);
  });

  it("a save whose mirror failed also clears the unsaved chip, but still warns", async () => {
    storeApi.mirrorWarning = "Saved, but not pushed to git: push rejected";
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    await byLabel(w, "Save").trigger("click");
    await flushPromises();
    expect(w.find('[data-severity="warning"]').exists()).toBe(true);
    expect(w.find('[data-tone="warning"]').exists()).toBe(false);
  });

  it("switching notebooks while dirty opens a discard-changes dialog instead of loading", async () => {
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    storeApi.get.mockClear();
    await w.find("select").setValue("n2");
    await flushPromises();
    expect(w.find('[data-title="Discard unsaved changes?"]').exists()).toBe(true);
    expect(storeApi.get).not.toHaveBeenCalled();
  });

  it("confirming the discard dialog loads the newly picked notebook", async () => {
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    await w.find("select").setValue("n2");
    await flushPromises();
    storeApi.get.mockClear();
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(storeApi.get).toHaveBeenCalledWith("n2");
  });

  it("cancelling the discard dialog leaves the original notebook loaded and selected", async () => {
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    await w.find("select").setValue("n2");
    await flushPromises();
    storeApi.get.mockClear();
    await w.findAll('[role="dialog"] .actions button')[0].trigger("click");
    await flushPromises();
    expect(storeApi.get).not.toHaveBeenCalled();
    expect(w.find('[data-title="Discard unsaved changes?"]').exists()).toBe(false);
    expect((w.find("select").element as HTMLSelectElement).value).toBe("n1");
  });

  it("switching notebooks while not dirty loads immediately without a dialog", async () => {
    const w = view("n1");
    await flushPromises();
    await w.find("select").setValue("n2");
    await flushPromises();
    expect(w.find('[data-title="Discard unsaved changes?"]').exists()).toBe(false);
    expect(storeApi.get).toHaveBeenCalledWith("n2");
  });

  it("the back button while dirty waits for confirmation before emitting back", async () => {
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    await w.find(".notebook-editor__back").trigger("click");
    expect(w.emitted("back")).toBeFalsy();
    expect(w.find('[data-title="Discard unsaved changes?"]').exists()).toBe(true);
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(w.emitted("back")).toBeTruthy();
  });

  it("a sync while dirty opens the discard dialog instead of reloading", async () => {
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    storeApi.get.mockClear();
    w.findComponent({ name: "SyncFromRemoteButton" }).vm.$emit("synced");
    await flushPromises();
    expect(w.find('[data-title="Discard unsaved changes?"]').exists()).toBe(true);
    expect(storeApi.get).not.toHaveBeenCalled();
  });

  it("confirming a sync-triggered discard reloads the active notebook", async () => {
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    w.findComponent({ name: "SyncFromRemoteButton" }).vm.$emit("synced");
    await flushPromises();
    storeApi.get.mockClear();
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(storeApi.get).toHaveBeenCalledWith("n1");
  });

  it("cancelling a sync-triggered discard leaves the on-screen content untouched", async () => {
    const w = view("n1");
    await flushPromises();
    edit(w);
    await flushPromises();
    w.findComponent({ name: "SyncFromRemoteButton" }).vm.$emit("synced");
    await flushPromises();
    storeApi.get.mockClear();
    setNotebookData.mockClear();
    await w.findAll('[role="dialog"] .actions button')[0].trigger("click");
    await flushPromises();
    expect(storeApi.get).not.toHaveBeenCalled();
    expect(setNotebookData).not.toHaveBeenCalled();
    expect(w.find('[data-title="Discard unsaved changes?"]').exists()).toBe(false);
    // The edits are still unsaved and on screen — cancelling only declined the
    // reload, it did not touch the row the sync already overwrote server-side.
    expect(w.find('[data-tone="warning"]').exists()).toBe(true);
  });

  it("a sync while not dirty reloads immediately with no dialog", async () => {
    const w = view("n1");
    await flushPromises();
    storeApi.get.mockClear();
    w.findComponent({ name: "SyncFromRemoteButton" }).vm.$emit("synced");
    await flushPromises();
    expect(w.find('[data-title="Discard unsaved changes?"]').exists()).toBe(false);
    expect(storeApi.get).toHaveBeenCalledWith("n1");
  });

  it("opens the create dialog automatically when mounted with no id (the ?new=1 deep link)", async () => {
    const w = view(null);
    await flushPromises();
    expect(w.find('[data-title="Create notebook"]').exists()).toBe(true);
    expect(storeApi.get).not.toHaveBeenCalled();
  });

  it("does not auto-open the create dialog when mounted with an id", async () => {
    const w = view("n1");
    await flushPromises();
    expect(w.find('[data-title="Create notebook"]').exists()).toBe(false);
    expect(storeApi.get).toHaveBeenCalledWith("n1");
  });

  it("cancelling the auto-opened create dialog leaves the empty state, not a blank screen", async () => {
    const w = view(null);
    await flushPromises();
    await w.findAll('[role="dialog"] .actions button')[0].trigger("click");
    await flushPromises();
    expect(w.find('[data-title="Create notebook"]').exists()).toBe(false);
    expect(w.text()).toContain("Select a notebook to get started");
  });

  it("confirming the auto-opened create dialog creates and loads the new notebook, going live", async () => {
    const w = view(null);
    await flushPromises();
    await w.find('[role="dialog"] input').setValue("Fresh");
    await w.findAll('[role="dialog"] .actions button')[1].trigger("click");
    await flushPromises();
    expect(storeApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Fresh" }));
    expect(storeApi.get).toHaveBeenCalledWith("n3");
  });
});
