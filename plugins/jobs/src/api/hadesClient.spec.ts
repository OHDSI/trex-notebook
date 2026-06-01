import { describe, it, expect, vi, beforeEach } from "vitest";
import { HadesClient } from "./hadesClient";

describe("HadesClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("listJobs GETs the jobs endpoint and returns the array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ jobs: [{ jobId: "j1" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HadesClient("http://x/plugins/hades-api/hades-api");
    const jobs = await c.listJobs();
    expect(fetchMock).toHaveBeenCalledWith("http://x/plugins/hades-api/hades-api/jobs", expect.any(Object));
    expect(jobs).toEqual([{ jobId: "j1" }]);
  });

  it("getJob GETs the item endpoint and returns the detail", async () => {
    const detail = { jobId: "j1", logTail: ["line1"] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => detail });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HadesClient("http://x/plugins/hades-api/hades-api");
    const job = await c.getJob("j1");
    expect(fetchMock).toHaveBeenCalledWith("http://x/plugins/hades-api/hades-api/jobs/j1", expect.any(Object));
    expect(job).toEqual(detail);
  });

  it("cancel DELETEs the item endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "cancelled", jobId: "j1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HadesClient("http://x/plugins/hades-api/hades-api");
    await c.cancel("j1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/plugins/hades-api/hades-api/jobs/j1");
    expect(init.method).toBe("DELETE");
  });

  it("execute POSTs the run request and returns jobId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jobId: "j9" }) });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HadesClient("http://x/plugins/hades-api/hades-api");
    const id = await c.execute({ spec: {}, cdmSchema: "cdm", envName: "e1" });
    expect(id).toBe("j9");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/plugins/hades-api/hades-api/jobs");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ cdmSchema: "cdm", envName: "e1" });
  });

  it("listEnvs GETs the envs endpoint and returns the array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ envs: [{ envName: "e1", path: "/p" }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HadesClient("http://x/plugins/hades-api/hades-api");
    const envs = await c.listEnvs();
    expect(fetchMock).toHaveBeenCalledWith("http://x/plugins/hades-api/hades-api/envs", expect.any(Object));
    expect(envs).toEqual([{ envName: "e1", path: "/p" }]);
  });

  it("setupEnv POSTs envName + lockfilePath to /envs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HadesClient("http://x/plugins/hades-api/hades-api");
    await c.setupEnv("study2", "/locks/renv.lock");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/plugins/hades-api/hades-api/envs");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ envName: "study2", lockfilePath: "/locks/renv.lock" });
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HadesClient("http://x/plugins/hades-api/hades-api");
    await expect(c.listJobs()).rejects.toThrow(/500/);
  });
});
