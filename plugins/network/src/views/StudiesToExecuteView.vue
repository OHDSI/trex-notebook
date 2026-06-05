<template>
  <div>
    <h2 class="text-h6 mb-3">Studies to execute</h2>
    <div class="rv-run-config mb-3">
      <AtlasTextField v-model="cdmSchema" label="CDM schema" class="rv-field" />
      <AtlasTextField v-model="envName" label="hades env" class="rv-field" />
    </div>
    <AtlasDataTable :headers="headers" :items="store.studies" hide-default-footer>
      <template #item.action="{ item }">
        <AtlasButton
          size="sm"
          variant="ghost"
          :loading="busy === item.studyId"
          @click="download(item.studyId)"
        >
          Download package
        </AtlasButton>
        <AtlasButton
          size="sm"
          variant="primary"
          :loading="running === item.studyId"
          :disabled="!canRun || (!!running && running !== item.studyId)"
          @click="runAndSubmit(item.studyId)"
        >
          Run &amp; submit
        </AtlasButton>
      </template>
    </AtlasDataTable>
    <AtlasAlert v-if="status" :severity="error ? 'danger' : 'info'" variant="tonal" class="mt-4">
      {{ status }}
    </AtlasAlert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { AtlasDataTable, AtlasButton, AtlasTextField, AtlasAlert } from '@ohdsi/atlas-ui';
import { useNetworkStore } from '../store/useNetworkStore';

const store = useNetworkStore();
const busy = ref('');
const running = ref('');
const cdmSchema = ref('main');
const envName = ref('default');
const status = ref('');
const error = ref(false);

const headers = [
  { key: 'name', title: 'Name' },
  { key: 'version', title: 'Version' },
  { key: 'action', title: '', sortable: false, align: 'end' as const },
];

onMounted(() => void store.loadStudies());

const canRun = computed(() => !!cdmSchema.value && !!envName.value);

async function download(studyId: string) {
  busy.value = studyId;
  try {
    const pkg = await store.getPackage(studyId);
    window.open(pkg.strategusUrl, '_blank');
    window.open(pkg.renvLockUrl, '_blank');
  } finally {
    busy.value = '';
  }
}

async function runAndSubmit(studyId: string) {
  running.value = studyId;
  error.value = false;
  status.value = 'Starting execution…';
  try {
    const jobId = await store.runStudy(studyId, { cdmSchema: cdmSchema.value, envName: envName.value });
    await store.awaitJob(jobId, (job) => {
      status.value = `Running: ${job.currentModule ?? job.status} (${job.modulesCompleted.length} modules done)`;
    });
    status.value = 'Compressing & uploading results…';
    const sub = await store.submitRun(studyId, jobId);
    status.value = `Submitted version ${sub.version}.`;
  } catch (e) {
    error.value = true;
    status.value = e instanceof Error ? e.message : 'run failed';
  } finally {
    running.value = '';
  }
}
</script>

<style scoped>
.rv-run-config {
  display: flex;
  gap: 16px;
}
.rv-field {
  flex: 1;
}
</style>
