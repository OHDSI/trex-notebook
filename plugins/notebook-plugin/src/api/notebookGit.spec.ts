import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mirrorNotebook, checkRemoteDiff, overwriteFromRemote, getTemplates, notebookGitBase } from "./notebookGit";

vi.mock("./authToken", () => ({
  ensureAuthToken: vi.fn().mockResolvedValue(undefined),
  authHeaders: () => ({ Authorization: "Bearer t" }),
}));

const ID = "3f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";

describe("notebookGit", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function ok(body: unknown) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => body,
    });
  }

  it("targets the d2e trex-function route", () => {
    // Trusted @ohdsi scope: trex mounts these under PLUGINS_BASE_PATH/<scope>/,
    // which is what lets the route use trex auth instead of the Logto path.
    expect(notebookGitBase()).toBe(`${location.origin}/plugins/ohdsi/notebook-git-api`);
  });

  it("mirrorNotebook POSTs to /:id/mirror with the auth header", async () => {
    ok({ status: "ok", action: "saved" });
    const res = await mirrorNotebook(ID);
    expect(res.status).toBe("ok");
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${notebookGitBase()}/${ID}/mirror`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t");
  });

  it("checkRemoteDiff GETs /:id/remote-diff-check", async () => {
    ok({ hasDifferences: true, reason: "Content differs from remote" });
    const res = await checkRemoteDiff(ID);
    expect(res.hasDifferences).toBe(true);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${notebookGitBase()}/${ID}/remote-diff-check`);
    expect(init.method).toBe("GET");
  });

  it("overwriteFromRemote POSTs /:id/overwrite-from-remote", async () => {
    ok({ message: "done", overwritten: true, notebookId: ID });
    const res = await overwriteFromRemote(ID);
    expect(res.overwritten).toBe(true);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0])
      .toBe(`${notebookGitBase()}/${ID}/overwrite-from-remote`);
  });

  it("getTemplates GETs /templates", async () => {
    ok([{ id: "t1", name: "T1", description: "d", content: { cells: [] } }]);
    const res = await getTemplates();
    expect(res).toHaveLength(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${notebookGitBase()}/templates`);
    expect(init.method).toBe("GET");
  });

  it("rejects with the server detail on a non-ok response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, status: 500, json: async () => ({ detail: "push rejected" }),
    });
    await expect(mirrorNotebook(ID)).rejects.toThrow("push rejected");
  });

  it("rejects with a status message when the error body is unreadable", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, status: 503, json: async () => { throw new Error("no body"); },
    });
    await expect(mirrorNotebook(ID)).rejects.toThrow("notebook-git 503");
  });

  it("awaits the trex token exchange before fetching", async () => {
    const { ensureAuthToken } = await import("./authToken");
    ok({ status: "ok" });
    await mirrorNotebook(ID);
    expect(ensureAuthToken).toHaveBeenCalled();
  });
});
