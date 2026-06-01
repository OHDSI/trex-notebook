import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useEnvsStore } from "./useEnvsStore";

const setupEnv = vi.fn().mockResolvedValue(undefined);
const listEnvs = vi.fn().mockResolvedValue([{ envName: "study1", path: "/e/study1" }]);
vi.mock("../api/hadesClient", () => ({
  defaultBase: () => "http://x",
  HadesClient: class { listEnvs = listEnvs; setupEnv = setupEnv; },
}));

describe("useEnvsStore", () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); });

  it("fetchEnvs populates envs", async () => {
    const s = useEnvsStore();
    await s.fetchEnvs();
    expect(s.envs).toHaveLength(1);
    expect(s.error).toBeNull();
  });

  it("provision calls setupEnv then refreshes", async () => {
    const s = useEnvsStore();
    await s.provision("study2", "/locks/study2/renv.lock");
    expect(setupEnv).toHaveBeenCalledWith("study2", "/locks/study2/renv.lock");
    expect(listEnvs).toHaveBeenCalled();
    expect(s.provisioning).toBe(false);
  });

  it("provision records errors and clears the busy flag", async () => {
    setupEnv.mockRejectedValueOnce(new Error("restore failed"));
    const s = useEnvsStore();
    await s.provision("study3", "/locks/study3/renv.lock");
    expect(s.error).toBe("restore failed");
    expect(s.provisioning).toBe(false);
  });
});
