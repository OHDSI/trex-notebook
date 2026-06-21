import { describe, it, expect, vi, beforeEach } from "vitest";
import { StorageClient } from "./storageClient";

describe("StorageClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signedUrl POSTs to the metadata-api /results/sign route with the right body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ signedURL: "/object/sign/b/k?token=x" }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { origin: "http://x" } as Location);

    const c = new StorageClient("http://x/plugins/metadata-api/metadata-api");
    const url = await c.signedUrl("analysis-results", "def1/job1.zip", 60);

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("http://x/plugins/metadata-api/metadata-api/results/sign");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.bucket).toBe("analysis-results");
    expect(body.key).toBe("def1/job1.zip");
    expect(body.expiresIn).toBe(60);
    // relative signedURL is resolved against origin
    expect(url).toBe("http://x/object/sign/b/k?token=x");
  });

  it("returns absolute signedURLs unchanged", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ signedURL: "http://cdn/x" }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { origin: "http://x" } as Location);

    const c = new StorageClient("http://x/plugins/metadata-api/metadata-api");
    expect(await c.signedUrl("b", "k")).toBe("http://cdn/x");
  });

  it("throws on non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const c = new StorageClient("http://x/plugins/metadata-api/metadata-api");
    await expect(c.signedUrl("b", "k")).rejects.toThrow("500");
  });
});
