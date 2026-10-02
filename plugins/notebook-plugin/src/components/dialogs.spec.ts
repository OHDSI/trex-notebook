import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import CreateNotebookDialog from "./CreateNotebookDialog.vue";
import NotebookDetailsDialog from "./NotebookDetailsDialog.vue";
import DeleteNotebookDialog from "./DeleteNotebookDialog.vue";

// These tests exercise the template dropdown, i.e. the ENABLED path. The real
// flag ships false (see notebookGit.ts); gitMirrorDisabled.spec.ts covers that.
const notebookGit = vi.hoisted(() => ({ GIT_MIRROR_ENABLED: true, getTemplates: vi.fn() }));
vi.mock("../api/notebookGit", () => notebookGit);

function actionButtons(w: ReturnType<typeof mount>) {
  return w.findAll(".actions button");
}

// Opens the dialog via a real false->true prop transition, same as the parent
// (createOpen.value = true) — the component is mounted once and toggled, so
// mounting already-open bypasses the "on open" watcher entirely.
async function open(w: ReturnType<typeof mount>) {
  await w.setProps({ open: true });
  await flushPromises();
}

describe("CreateNotebookDialog", () => {
  beforeEach(() => {
    notebookGit.getTemplates.mockReset().mockResolvedValue([]);
  });

  it("renders nothing while closed", () => {
    const w = mount(CreateNotebookDialog, { props: { open: false, existingNames: [] } });
    expect(w.find('[role="dialog"]').exists()).toBe(false);
  });

  it("defaults the notebook name to Untitled", () => {
    const w = mount(CreateNotebookDialog, { props: { open: true, existingNames: [] } });
    expect((w.find("input").element as HTMLInputElement).value).toBe("Untitled");
  });

  it("selects the name field's text when the dialog opens", async () => {
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");
    const w = mount(CreateNotebookDialog, {
      props: { open: false, existingNames: [] },
      attachTo: document.body,
    });
    await open(w);
    expect(selectSpy).toHaveBeenCalled();
    w.unmount();
    selectSpy.mockRestore();
  });

  it("loads templates on open, listing the no-template option first", async () => {
    notebookGit.getTemplates.mockResolvedValue([
      { id: "t1", name: "Template One", description: "", content: {} },
    ]);
    const w = mount(CreateNotebookDialog, { props: { open: false, existingNames: [] } });
    await open(w);
    const options = w.findAll("select option");
    expect(options[0].text()).toBe("— No template (blank notebook) —");
    expect(options[1].text()).toBe("Template One");
  });

  it("fails silently when the template repo is unavailable, keeping just the no-template option", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    notebookGit.getTemplates.mockRejectedValue(new Error("no repo configured"));
    const w = mount(CreateNotebookDialog, { props: { open: false, existingNames: [] } });
    await open(w);
    const options = w.findAll("select option");
    expect(options).toHaveLength(1);
    expect(options[0].text()).toBe("— No template (blank notebook) —");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("confirms a trimmed name with no template selected", async () => {
    const w = mount(CreateNotebookDialog, { props: { open: true, existingNames: [] } });
    await w.find("input").setValue("  My notebook  ");
    await actionButtons(w)[1].trigger("click");
    expect(w.emitted("confirm")?.[0]).toEqual(["My notebook", null]);
  });

  it("confirms with the selected template's id", async () => {
    notebookGit.getTemplates.mockResolvedValue([
      { id: "t1", name: "Template One", description: "", content: {} },
    ]);
    const w = mount(CreateNotebookDialog, { props: { open: false, existingNames: [] } });
    await open(w);
    await w.find("input").setValue("My notebook");
    await w.find("select").setValue("t1");
    await actionButtons(w)[1].trigger("click");
    expect(w.emitted("confirm")?.[0]).toEqual(["My notebook", "t1"]);
  });

  it("blocks a name that differs only by case and shows an error", async () => {
    const w = mount(CreateNotebookDialog, { props: { open: true, existingNames: ["Taken"] } });
    await w.find("input").setValue("taken");
    await actionButtons(w)[1].trigger("click");
    expect(w.emitted("confirm")).toBeFalsy();
    expect(w.text()).toContain("already exists");
  });

  it("cannot confirm an empty name", async () => {
    const w = mount(CreateNotebookDialog, { props: { open: true, existingNames: [] } });
    await w.find("input").setValue("   ");
    expect(actionButtons(w)[1].attributes("disabled")).toBeDefined();
  });

  it("emits cancel from the first action", async () => {
    const w = mount(CreateNotebookDialog, { props: { open: true, existingNames: [] } });
    await actionButtons(w)[0].trigger("click");
    expect(w.emitted("cancel")).toBeTruthy();
  });
});

describe("NotebookDetailsDialog", () => {
  it("seeds both fields from props", async () => {
    const w = mount(NotebookDetailsDialog, {
      props: { open: true, name: "N", description: "D", existingNames: [] },
    });
    await flushPromises();
    const inputs = w.findAll("input");
    expect((inputs[0].element as HTMLInputElement).value).toBe("N");
    expect((inputs[1].element as HTMLInputElement).value).toBe("D");
  });

  it("confirms name and description together", async () => {
    const w = mount(NotebookDetailsDialog, {
      props: { open: true, name: "N", description: "D", existingNames: [] },
    });
    const inputs = w.findAll("input");
    await inputs[0].setValue("N2");
    await inputs[1].setValue("D2");
    await actionButtons(w)[1].trigger("click");
    expect(w.emitted("confirm")?.[0]).toEqual([{ name: "N2", description: "D2" }]);
  });

  it("blocks a rename onto another notebook's name", async () => {
    const w = mount(NotebookDetailsDialog, {
      props: { open: true, name: "Mine", description: "", existingNames: ["Other"] },
    });
    await w.findAll("input")[0].setValue("other");
    await actionButtons(w)[1].trigger("click");
    expect(w.emitted("confirm")).toBeFalsy();
    expect(w.text()).toContain("already exists");
  });

  it("allows keeping the notebook's own name unchanged", async () => {
    const w = mount(NotebookDetailsDialog, {
      props: { open: true, name: "Mine", description: "", existingNames: ["Other"] },
    });
    await actionButtons(w)[1].trigger("click");
    expect(w.emitted("confirm")?.[0]).toEqual([{ name: "Mine", description: "" }]);
  });
});

describe("DeleteNotebookDialog", () => {
  it("names the notebook and confirms", async () => {
    const w = mount(DeleteNotebookDialog, { props: { open: true, notebookName: "Doomed" } });
    expect(w.text()).toContain("Doomed");
    await actionButtons(w)[1].trigger("click");
    expect(w.emitted("confirm")).toBeTruthy();
  });
});
