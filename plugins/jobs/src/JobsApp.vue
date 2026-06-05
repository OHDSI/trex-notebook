<template>
  <AtlasPageShell
    hero
    compact
    eyebrow="OHDSI · Execution"
    title="Jobs"
    subtitle="Monitor and manage HADES/Strategus execution jobs and environments"
  >
    <div class="jobs-plugin">
      <nav class="tabs">
        <button :class="{ active: tab === 'jobs' }" @click="tab = 'jobs'">Jobs</button>
        <button :class="{ active: tab === 'envs' }" @click="tab = 'envs'">Environments</button>
        <button :class="{ active: tab === 'definitions' }" @click="tab = 'definitions'">Definitions</button>
        <button :class="{ active: tab === 'results' }" @click="tab = 'results'">Results</button>
        <button :class="{ active: tab === 'connections' }" @click="tab = 'connections'">Connections</button>
      </nav>
      <JobsView v-if="tab === 'jobs'" />
      <DefinitionsView v-else-if="tab === 'definitions'" />
      <ResultsView v-else-if="tab === 'results'" />
      <ConnectionsView v-else-if="tab === 'connections'" />
      <EnvironmentsView v-else />
    </div>
  </AtlasPageShell>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { AtlasPageShell } from "@ohdsi/atlas-ui";
import JobsView from "./views/JobsView.vue";
import EnvironmentsView from "./views/EnvironmentsView.vue";
import DefinitionsView from "./views/DefinitionsView.vue";
import ResultsView from "./views/ResultsView.vue";
import ConnectionsView from "./views/ConnectionsView.vue";
const tab = ref<"jobs" | "envs" | "definitions" | "results" | "connections">("jobs");
</script>
<style scoped>
.jobs-plugin { padding: 12px; }
.tabs { display: flex; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12); }
.tabs button { background: none; border: none; padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; }
.tabs button.active { border-bottom-color: rgb(var(--v-theme-primary)); font-weight: 600; }
</style>
