<template>
  <aside v-if="job" class="detail-drawer">
    <header>
      <strong>{{ job.jobId }}</strong>
      <button class="close" @click="$emit('close')">×</button>
    </header>
    <dl>
      <dt>Status</dt><dd><StatusChip :status="job.status" /></dd>
      <dt>Environment</dt><dd>{{ job.envName || "—" }}</dd>
      <dt>Database</dt><dd>{{ job.databaseName || "—" }}</dd>
      <dt>Current module</dt><dd>{{ job.currentModule ?? "—" }}</dd>
      <dt>Completed</dt><dd>{{ job.modulesCompleted.join(", ") || "—" }}</dd>
      <template v-if="job.errorMessage">
        <dt>Error</dt><dd class="error">{{ job.errorMessage }}</dd>
      </template>
    </dl>
    <pre class="logs">{{ job.logTail.join("\n") }}</pre>
  </aside>
</template>
<script setup lang="ts">
import type { HadesJobDetail } from "../api/types";
import StatusChip from "./StatusChip.vue";
defineProps<{ job: HadesJobDetail | null }>();
defineEmits<{ close: [] }>();
</script>
<style scoped>
.detail-drawer { border-left: 1px solid #ddd; padding: 12px; width: 420px; }
.detail-drawer header { display: flex; justify-content: space-between; align-items: center; }
.close { background: none; border: none; font-size: 18px; cursor: pointer; }
.logs { background: #111; color: #ddd; padding: 8px; max-height: 320px; overflow: auto; font-size: 12px; }
.error { color: #c62828; }
</style>
