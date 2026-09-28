import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import SyncFromRemoteButton from "./SyncFromRemoteButton.vue";

const checkRemoteDiff = vi.fn();
const overwriteFromRemote = vi.fn();
vi.mock("../api/notebookGit", () => ({
  GIT_MIRROR_ENABLED: true,
  checkRemoteDiff: (...a: unknown[]) => checkRemoteDiff(...a),
  overwriteFromRemote: (...a: unknown[]) => overwriteFromRemote(...a),
}));

const ID = "3f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";

describe("SyncFromRemoteButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing without a notebook id", () => {
    const w = mount(SyncFromRemoteButton, { props: { notebookId: null } });
    expect(w.find("button").exists()).toBe(false);
  });

  // The whole point of check-on-demand: Atlas's login-guard shows its sign-in
  // dialog on ANY 401, so a request fired on mount logs the user out of the page.
  it("makes NO request on mount", async () => {
    mount(SyncFromRemoteButton, { props: { notebookId: ID } });
    await flushPromises();
    expect(checkRemoteDiff).not.toHaveBeenCalled();
    expect(overwriteFromRemote).not.toHaveBeenCalled();
  });

  it("is enabled on mount so the user can always ask", async () => {
    const w = mount(SyncFromRemoteButton, { props: { notebookId: ID } });
    await flushPromises();
    expect(w.find("button").attributes("disabled")).toBeUndefined();
  });

  it("checks then pulls when the remote differs", async () => {
    checkRemoteDiff.mockResolvedValue({ hasDifferences: true, reason: "differs" });
    overwriteFromRemote.mockResolvedValue({ message: "ok", overwritten: true, notebookId: ID });
    const w = mount(SyncFromRemoteButton, { props: { notebookId: ID } });
    await w.find("button").trigger("click");
    await flushPromises();
    expect(checkRemoteDiff).toHaveBeenCalledWith(ID);
    expect(overwriteFromRemote).toHaveBeenCalledWith(ID);
    expect(w.emitted("synced")).toBeTruthy();
    expect(w.emitted("feedback")?.[0]).toEqual(["success", "Notebook overwritten from remote."]);
  });

  it("does not pull when already up to date, and says so", async () => {
    checkRemoteDiff.mockResolvedValue({ hasDifferences: false, reason: "Content is identical to remote" });
    const w = mount(SyncFromRemoteButton, { props: { notebookId: ID } });
    await w.find("button").trigger("click");
    await flushPromises();
    expect(overwriteFromRemote).not.toHaveBeenCalled();
    expect(w.emitted("synced")).toBeFalsy();
    expect(w.emitted("feedback")?.[0]).toEqual(["success", "Content is identical to remote"]);
  });

  it("reports an error and does not emit synced when the check fails", async () => {
    checkRemoteDiff.mockRejectedValue(new Error("notebook-git 401"));
    const w = mount(SyncFromRemoteButton, { props: { notebookId: ID } });
    await w.find("button").trigger("click");
    await flushPromises();
    expect(w.emitted("synced")).toBeFalsy();
    expect(w.emitted("feedback")?.[0]?.[0]).toBe("error");
    expect(String(w.emitted("feedback")?.[0]?.[1])).toContain("401");
  });

  it("reports an error when the pull itself fails", async () => {
    checkRemoteDiff.mockResolvedValue({ hasDifferences: true, reason: "differs" });
    overwriteFromRemote.mockRejectedValue(new Error("pull failed"));
    const w = mount(SyncFromRemoteButton, { props: { notebookId: ID } });
    await w.find("button").trigger("click");
    await flushPromises();
    expect(w.emitted("synced")).toBeFalsy();
    expect(String(w.emitted("feedback")?.[0]?.[1])).toContain("pull failed");
  });

  it("ignores a second click while already syncing", async () => {
    let resolve!: (v: unknown) => void;
    checkRemoteDiff.mockReturnValue(new Promise((r) => { resolve = r; }));
    const w = mount(SyncFromRemoteButton, { props: { notebookId: ID } });
    await w.find("button").trigger("click");
    await w.find("button").trigger("click");
    expect(checkRemoteDiff).toHaveBeenCalledTimes(1);
    resolve({ hasDifferences: false, reason: "x" });
    await flushPromises();
  });
});
