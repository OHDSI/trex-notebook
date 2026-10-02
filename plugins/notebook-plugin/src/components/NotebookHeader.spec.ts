import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import NotebookHeader from "./NotebookHeader.vue";
import NotebookEmptyState from "./NotebookEmptyState.vue";

vi.mock("../api/notebookGit", () => ({
  GIT_MIRROR_ENABLED: true,
  checkRemoteDiff: vi.fn().mockResolvedValue({ hasDifferences: false, reason: "x" }),
  overwriteFromRemote: vi.fn(),
}));

const notebooks = [
  { rowId: "n1", name: "First", description: "", createdAt: "t", updatedAt: "t", deletedAt: null },
  { rowId: "n2", name: "Second", description: "", createdAt: "t", updatedAt: "t", deletedAt: null },
];

function header(props: Record<string, unknown> = {}) {
  return mount(NotebookHeader, {
    props: { notebooks, activeId: "n1", canSave: true, ...props },
  });
}

function byLabel(w: ReturnType<typeof mount>, label: string) {
  return w.findAll("button").find((b) => b.text() === label)!;
}

describe("NotebookHeader", () => {
  it("lists every notebook in the picker", () => {
    const options = header().findAll("option");
    expect(options.map((o) => o.text())).toEqual(["First", "Second"]);
  });

  it("emits select with the chosen rowId", async () => {
    const w = header();
    await w.find("select").setValue("n2");
    expect(w.emitted("select")?.[0]).toEqual(["n2"]);
  });

  it("emits rename from the pencil", async () => {
    const w = header();
    await w.find('[aria-label="Rename"]').trigger("click");
    expect(w.emitted("rename")).toBeTruthy();
  });

  it("emits the action events", async () => {
    const w = header();
    for (const label of ["Export", "Import", "New", "Save", "Delete"]) {
      await byLabel(w, label).trigger("click");
    }
    expect(w.emitted("export")).toBeTruthy();
    expect(w.emitted("import")).toBeTruthy();
    expect(w.emitted("create")).toBeTruthy();
    expect(w.emitted("save")).toBeTruthy();
    expect(w.emitted("delete")).toBeTruthy();
  });

  it("disables Save, Delete and Export with no active notebook", () => {
    const w = header({ activeId: null });
    expect(byLabel(w, "Save").attributes("disabled")).toBeDefined();
    expect(byLabel(w, "Delete").attributes("disabled")).toBeDefined();
    expect(byLabel(w, "Export").attributes("disabled")).toBeDefined();
  });

  it("keeps New and Import enabled with no active notebook", () => {
    const w = header({ activeId: null });
    expect(byLabel(w, "New").attributes("disabled")).toBeUndefined();
    expect(byLabel(w, "Import").attributes("disabled")).toBeUndefined();
  });

  it("disables Save when canSave is false", () => {
    expect(byLabel(header({ canSave: false }), "Save").attributes("disabled")).toBeDefined();
  });

  it("hides the rename pencil with no active notebook", () => {
    expect(header({ activeId: null }).find('[aria-label="Rename"]').exists()).toBe(false);
  });
});

describe("NotebookEmptyState", () => {
  it("prompts to create when there are no notebooks", () => {
    const w = mount(NotebookEmptyState, { props: { hasNotebooks: false } });
    expect(w.text()).toContain("No notebooks yet");
  });

  it("prompts to choose one when notebooks exist", () => {
    const w = mount(NotebookEmptyState, { props: { hasNotebooks: true } });
    expect(w.text()).toContain("Select a notebook");
  });

  it("emits create and import", async () => {
    const w = mount(NotebookEmptyState, { props: { hasNotebooks: false } });
    const buttons = w.findAll("button");
    await buttons[0].trigger("click");
    await buttons[1].trigger("click");
    expect(w.emitted("create")).toBeTruthy();
    expect(w.emitted("import")).toBeTruthy();
  });
});
