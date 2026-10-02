<template>
  <div class="studies-section-body">
    <SectionHero eyebrow="OHDSI · Results" title="Results" subtitle="Study results — download one to explore it in the viewer">
    <template #actions>
      <input
        ref="fileInput"
        type="file"
        accept=".zip,.db,.db.gz"
        style="display: none"
        @change="onFile"
      />
      <AtlasButton
        variant="primary"
        prepend-icon="mdi-upload-outline"
        @click="fileInput?.click()"
      >
        Import result
      </AtlasButton>
    </template>
    </SectionHero>

    <AtlasAlert v-if="error" severity="danger" class="mb-4">{{ error }}</AtlasAlert>

    <AtlasDataTable
      :headers="headers"
      :items="items"
      :loading="loading"
      item-value="id"
    >
      <template #item.name="{ item }">
        <a
          v-if="item.downloaded"
          class="text-primary"
          style="cursor: pointer"
          @click="open(item)"
        >{{ displayName(item.name) }}</a>
        <span v-else>{{ displayName(item.name) }}</span>
      </template>
      <template #item.size="{ item }">{{ formatSize(item.size) }}</template>
      <template #item.addedAt="{ item }">{{ formatDate(item.addedAt) }}</template>
      <template #item.actions="{ item }">
        <AtlasIconButton
          v-if="item.source === 'backend' && !item.downloaded"
          icon="mdi-download-outline"
          ariaLabel="Download result"
          size="sm"
          :loading="downloadingId === item.id"
          @click="download(item)"
        />
        <AtlasIconButton
          v-if="item.source === 'local'"
          icon="mdi-delete-outline"
          ariaLabel="Delete result"
          size="sm"
          @click="remove(item)"
        />
      </template>
      <template #no-data>No results yet — results uploaded by a flow run appear here once complete</template>
    </AtlasDataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, type Ref } from 'vue';
import { AtlasDataTable, AtlasAlert, AtlasButton, AtlasIconButton } from '@ohdsi/atlas-ui';
import SectionHero from '../components/SectionHero.vue';
import { listResults, addResult, deleteResult, saveDownloadedResult, formatSize, type ResultMeta } from '../data/results';
import { listBackendResults, downloadBackendResult } from '../api/resultsApi';

// Setting this (provided by StudiesApp) opens the full-screen viewer for that id.
const openResultId = inject<Ref<string | null>>('studiesOpenResult')!;

interface Row extends ResultMeta {
  /** 'backend' rows come from GET /strategus/results; 'local' rows exist only
   * in this browser's IndexedDB (legacy manual imports never uploaded to the
   * backend). */
  source: 'backend' | 'local';
  /** Whether the zip is cached in this browser's IndexedDB and can be opened. */
  downloaded: boolean;
}

const items = ref<Row[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const downloadingId = ref<string | null>(null);

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Size', key: 'size' },
  { title: 'Added', key: 'addedAt' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
];

// Display the result by a study-like name rather than the raw upload filename:
// drop the archive extension and turn separators into spaces.
function displayName(name: string): string {
  return name
    .replace(/\.(db\.gz|zip|db)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

/**
 * Backend results (source of truth for flow-run uploads) plus any
 * legacy locally-imported result not known to the backend. A backend row
 * is marked `downloaded` once its zip has been cached locally via the
 * Download action, so "open" works against the same IndexedDB store the
 * results-viewer plugin reads from.
 */
async function reload(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [backendSettled, localSettled] = await Promise.allSettled([listBackendResults(), listResults()]);

    // Independent failure handling: a backend outage shouldn't hide results
    // that already live in this browser's IndexedDB, and vice versa.
    const backendResults = backendSettled.status === 'fulfilled' ? backendSettled.value : [];
    const localItems = localSettled.status === 'fulfilled' ? localSettled.value : [];

    const failure = backendSettled.status === 'rejected' ? backendSettled.reason : localSettled.status === 'rejected' ? localSettled.reason : null;
    if (failure) {
      error.value = failure instanceof Error ? failure.message : String(failure);
    }

    const localIds = new Set(localItems.map((m) => m.id));

    const backendRows: Row[] = backendResults.map((r) => ({
      id: r.id,
      name: r.fileName,
      size: r.fileSize,
      addedAt: new Date(r.createdAt).getTime(),
      source: 'backend',
      downloaded: localIds.has(r.id),
    }));

    const backendIds = new Set(backendResults.map((r) => r.id));
    const localOnlyRows: Row[] = localItems
      .filter((m) => !backendIds.has(m.id))
      .map((m) => ({ ...m, source: 'local', downloaded: true }));

    items.value = [...backendRows, ...localOnlyRows].sort((a, b) => b.addedAt - a.addedAt);
  } finally {
    loading.value = false;
  }
}

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    await addResult(file);
    await reload();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

function open(item: Row): void {
  openResultId.value = item.id;
}

async function download(item: Row): Promise<void> {
  downloadingId.value = item.id;
  error.value = null;
  try {
    const blob = await downloadBackendResult(item.id);
    await saveDownloadedResult({ id: item.id, name: item.name, size: item.size }, blob);
    await reload();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    downloadingId.value = null;
  }
}

async function remove(item: Row): Promise<void> {
  try {
    await deleteResult(item.id);
    await reload();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

onMounted(reload);
</script>

<style scoped>
.studies-section-body { padding: 20px 24px; }
</style>
