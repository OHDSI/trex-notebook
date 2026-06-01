<template>
  <section class="results-view">
    <div class="toolbar">
      <button @click="store.fetch()">Refresh</button>
    </div>
    <p v-if="store.error" class="error">{{ store.error }}</p>
    <p v-if="note" class="error">{{ note }}</p>
    <table>
      <thead>
        <tr><th>Job</th><th>Status</th><th>Size</th><th>Created</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="r in store.results" :key="r.rowId">
          <td>{{ r.jobId }}</td>
          <td>{{ r.status }}</td>
          <td>{{ formatSize(r.sizeBytes) }}</td>
          <td>{{ new Date(r.createdAt).toLocaleString() }}</td>
          <td>
            <button @click="download(r.storageBucket, r.storageKey)">Download</button>
          </td>
        </tr>
        <tr v-if="store.results.length === 0">
          <td colspan="5" class="empty">No published results.</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useResultsStore } from "../store/useResultsStore";
import { StorageClient, defaultStorageBase } from "../api/storageClient";

const store = useResultsStore();
const storage = new StorageClient(defaultStorageBase());
const note = ref("");

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function download(bucket: string, key: string) {
  try {
    const url = await storage.signedUrl(bucket, key);
    window.location.assign(url);
  } catch (e) {
    note.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(() => store.fetch());
</script>
<style scoped>
.results-view { display: flex; flex-direction: column; gap: 8px; }
.toolbar { display: flex; gap: 8px; align-items: center; }
table { border-collapse: collapse; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eee; }
.empty { color: #888; text-align: center; }
.error { color: #c62828; }
</style>
