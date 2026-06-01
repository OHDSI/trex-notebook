import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { HadesJob } from "../api/types";
import { HadesClient, defaultBase } from "../api/hadesClient";

const POLLING_INTERVAL_MS = 2000;
const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED"];

export const useJobsStore = defineStore("jobs", () => {
  const client = new HadesClient(defaultBase());
  const jobs = ref<HadesJob[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pollingEnabled = ref(false);
  let pollingIntervalId: ReturnType<typeof setInterval> | null = null;

  const runningJobs = computed(() => jobs.value.filter((j) => !TERMINAL.includes(j.status)));
  const hasActiveJobs = computed(() => runningJobs.value.length > 0);

  async function fetchJobs(): Promise<void> {
    loading.value = true;
    try {
      jobs.value = await client.listJobs();
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
    // Stop polling once nothing is left running (terminal-status auto-stop).
    if (pollingEnabled.value && !hasActiveJobs.value && jobs.value.length > 0) {
      stopPolling();
    }
  }

  function startPolling(): void {
    if (pollingIntervalId) return;
    pollingEnabled.value = true;
    pollingIntervalId = setInterval(() => { fetchJobs(); }, POLLING_INTERVAL_MS);
    fetchJobs();
  }

  function stopPolling(): void {
    if (pollingIntervalId) { clearInterval(pollingIntervalId); pollingIntervalId = null; }
    pollingEnabled.value = false;
  }

  return { jobs, loading, error, pollingEnabled, runningJobs, hasActiveJobs, fetchJobs, startPolling, stopPolling };
});
