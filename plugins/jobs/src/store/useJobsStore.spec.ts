import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useJobsStore } from "./useJobsStore";

vi.mock("../api/hadesClient", () => ({
  defaultBase: () => "http://x",
  HadesClient: class {
    listJobs = vi.fn().mockResolvedValue([
      { jobId: "j1", status: "RUNNING" },
      { jobId: "j2", status: "COMPLETED" },
    ]);
  },
}));

describe("useJobsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("fetchJobs populates jobs and clears error", async () => {
    const s = useJobsStore();
    await s.fetchJobs();
    expect(s.jobs).toHaveLength(2);
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
  });

  it("runningJobs filters non-terminal statuses", async () => {
    const s = useJobsStore();
    await s.fetchJobs();
    expect(s.runningJobs).toHaveLength(1);
    expect(s.runningJobs[0].jobId).toBe("j1");
  });

  it("startPolling sets pollingEnabled and stopPolling clears it", async () => {
    const s = useJobsStore();
    s.startPolling();
    expect(s.pollingEnabled).toBe(true);
    s.stopPolling();
    expect(s.pollingEnabled).toBe(false);
  });

  it("startPolling polls on the interval", async () => {
    const s = useJobsStore();
    s.startPolling();
    await vi.advanceTimersByTimeAsync(0); // immediate fetch
    expect(s.jobs).toHaveLength(2);
    s.jobs = [];
    await vi.advanceTimersByTimeAsync(2000); // next interval tick
    expect(s.jobs).toHaveLength(2);
    s.stopPolling();
  });
});
