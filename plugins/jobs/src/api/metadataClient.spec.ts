import { describe, it, expect, vi, beforeEach } from "vitest";
import { MetadataClient } from "./metadataClient";

describe("MetadataClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("setPassword POSTs to the cdm password route with credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);
    const c = new MetadataClient("http://x/plugins/metadata-api/metadata-api");
    await c.setPassword("conn1", "secret");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/plugins/metadata-api/metadata-api/cdm-connections/conn1/password");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body).password).toBe("secret");
  });

  it("publishResult POSTs jobId (and optional ids) to /results/publish", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);
    const c = new MetadataClient("http://x/plugins/metadata-api/metadata-api");
    await c.publishResult("job1", "def1", "cdm1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/plugins/metadata-api/metadata-api/results/publish");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.jobId).toBe("job1");
    expect(body.definitionId).toBe("def1");
    expect(body.cdmConnectionId).toBe("cdm1");
  });

  it("throws on non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const c = new MetadataClient("http://x/plugins/metadata-api/metadata-api");
    await expect(c.setPassword("c", "p")).rejects.toThrow("500");
  });
});
