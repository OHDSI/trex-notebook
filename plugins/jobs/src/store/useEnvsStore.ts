import { defineStore } from "pinia";
import { ref } from "vue";
import type { HadesEnv } from "../api/types";
import { HadesClient, defaultBase } from "../api/hadesClient";

export const useEnvsStore = defineStore("envs", () => {
  const client = new HadesClient(defaultBase());
  const envs = ref<HadesEnv[]>([]);
  const provisioning = ref(false);
  const error = ref<string | null>(null);

  async function fetchEnvs(): Promise<void> {
    try { envs.value = await client.listEnvs(); error.value = null; }
    catch (e) { error.value = e instanceof Error ? e.message : String(e); }
  }
  async function provision(envName: string, lockfilePath: string): Promise<void> {
    provisioning.value = true; error.value = null;
    try { await client.setupEnv(envName, lockfilePath); await fetchEnvs(); }
    catch (e) { error.value = e instanceof Error ? e.message : String(e); }
    finally { provisioning.value = false; }
  }
  return { envs, provisioning, error, fetchEnvs, provision };
});
