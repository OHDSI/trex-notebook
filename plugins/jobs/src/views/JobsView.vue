<template>
  <section class="jobs-view">
    <div class="toolbar">
      <button
        v-for="f in filters"
        :key="f"
        :class="{ active: filter === f }"
        @click="filter = f"
      >
        {{ f }} ({{ count(f) }})
      </button>
      <button @click="store.fetchJobs()">Refresh</button>
      <label class="poll">
        <input type="checkbox" :checked="store.pollingEnabled" @change="togglePolling" />
        Auto-refresh
      </label>
    </div>
    <p v-if="store.error" class="error">{{ store.error }}</p>
    <p v-if="publishNote" class="note">{{ publishNote }}</p>
    <div class="layout">
      <table>
        <thead>
          <tr><th>Job</th><th>Status</th><th>Env</th><th>Module</th><th>Elapsed</th><th></th></tr>
        </thead>
        <tbody>
          <tr
            v-for="j in filtered"
            :key="j.jobId"
            :class="{ selected: selected?.jobId === j.jobId }"
            @click="open(j.jobId)"
          >
            <td>{{ j.jobId }}</td>
            <td><StatusChip :status="j.status" /></td>
            <td>{{ j.envName || "—" }}</td>
            <td>{{ j.currentModule ?? "—" }}</td>
            <td>{{ Math.round(j.elapsedMs / 1000) }}s</td>
            <td @click.stop>
              <button
                v-if="j.status === 'COMPLETED'"
                :disabled="publishing === j.jobId"
                @click="publish(j.jobId)"
              >
                {{ publishing === j.jobId ? "Publishing…" : "Publish" }}
              </button>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="6" class="empty">No jobs.</td>
          </tr>
        </tbody>
      </table>
      <JobDetailDrawer :job="selected" @close="selected = null" />
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useJobsStore } from "../store/useJobsStore";
import { useResultsStore } from "../store/useResultsStore";
import { HadesClient, defaultBase } from "../api/hadesClient";
import { MetadataClient, defaultMetadataBase } from "../api/metadataClient";
import type { HadesJobDetail } from "../api/types";
import StatusChip from "../components/StatusChip.vue";
import JobDetailDrawer from "../components/JobDetailDrawer.vue";

const store = useJobsStore();
const resultsStore = useResultsStore();
const client = new HadesClient(defaultBase());
const metadata = new MetadataClient(defaultMetadataBase());
const publishing = ref<string | null>(null);
const publishNote = ref("");
const filters = ["All", "Running", "Completed", "Failed"] as const;
const filter = ref<(typeof filters)[number]>("All");
const selected = ref<HadesJobDetail | null>(null);

const byFilter = (f: string) => store.jobs.filter((j) =>
  f === "All" ? true :
  f === "Running" ? j.status === "RUNNING" :
  f === "Completed" ? j.status === "COMPLETED" :
  j.status === "FAILED");
const filtered = computed(() => byFilter(filter.value));
const count = (f: string) => byFilter(f).length;

async function open(id: string) {
  selected.value = await client.getJob(id);
}
function togglePolling() {
  store.pollingEnabled ? store.stopPolling() : store.startPolling();
}

async function publish(jobId: string) {
  publishing.value = jobId;
  publishNote.value = "";
  try {
    await metadata.publishResult(jobId);
    await resultsStore.fetch();
    publishNote.value = `Published ${jobId} — see the Results tab.`;
  } catch (e) {
    publishNote.value = `Publish failed: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    publishing.value = null;
  }
}

onMounted(() => {
  store.startPolling();
  const jobParam = new URLSearchParams(location.search).get("job");
  if (jobParam) open(jobParam);
});
onUnmounted(() => store.stopPolling());
</script>
<style scoped>
.jobs-view { display: flex; flex-direction: column; gap: 8px; }
.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.toolbar button.active { font-weight: 600; }
.poll { display: flex; align-items: center; gap: 4px; font-size: 13px; }
.layout { display: flex; gap: 12px; align-items: flex-start; }
table { border-collapse: collapse; flex: 1; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eee; }
tbody tr { cursor: pointer; }
tbody tr.selected { background: #e3f2fd; }
.empty { color: #888; text-align: center; }
.error { color: #c62828; }
.note { color: #2e7d32; font-size: 13px; }
</style>
