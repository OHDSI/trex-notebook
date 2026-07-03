<template>
  <div class="studies-results-list">
    <header class="studies-results-list__head">
      <div>
        <h1 class="text-h4">Results</h1>
        <p class="text-subtitle-1">Imported study results — open one to explore it in the viewer</p>
      </div>
      <div class="studies-results-list__actions">
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
      </div>
    </header>

    <AtlasAlert v-if="error" severity="danger" class="mb-4">{{ error }}</AtlasAlert>

    <AtlasDataTable
      :headers="headers"
      :items="items"
      :loading="loading"
      item-value="id"
    >
      <template #item.name="{ item }">
        <a class="text-primary" style="cursor: pointer" @click="open(item)">{{ item.name }}</a>
      </template>
      <template #item.size="{ item }">{{ formatSize(item.size) }}</template>
      <template #item.addedAt="{ item }">{{ formatDate(item.addedAt) }}</template>
      <template #item.actions="{ item }">
        <AtlasIconButton
          icon="mdi-delete-outline"
          ariaLabel="Delete result"
          size="sm"
          @click="remove(item)"
        />
      </template>
      <template #no-data>No results imported yet — use "Import result" to add one</template>
    </AtlasDataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, type Ref } from 'vue';
import { AtlasDataTable, AtlasAlert, AtlasButton, AtlasIconButton } from '@ohdsi/atlas-ui';
import { listResults, addResult, deleteResult, formatSize, type ResultMeta } from '../data/results';

// Setting this (provided by StudiesApp) opens the full-screen viewer for that id.
const openResultId = inject<Ref<string | null>>('studiesOpenResult')!;

const items = ref<ResultMeta[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Size', key: 'size' },
  { title: 'Added', key: 'addedAt' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
];

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

async function reload(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await listResults();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
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

function open(item: ResultMeta): void {
  openResultId.value = item.id;
}

async function remove(item: ResultMeta): Promise<void> {
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
.studies-results-list {
  padding: 28px 32px;
}
.studies-results-list__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.studies-results-list__head h1.text-h4 {
  font-size: 34px;
  font-weight: 300;
  line-height: 1.2;
  color: rgb(var(--v-theme-primary));
}
.studies-results-list__head .text-subtitle-1 {
  font-size: 14px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.62);
  margin-top: 2px;
}
.studies-results-list__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
