<template>
  <AtlasPageShell
    hero
    compact
    eyebrow="OHDSI · Results"
    title="Results"
    subtitle="Study execution results"
  >
    <template #actions>
      <AtlasIconButton icon="mdi-upload-outline" ariaLabel="Import result" size="sm" @click="goToImport" />
    </template>

    <AtlasAlert v-if="error" severity="danger" class="mb-4">{{ error }}</AtlasAlert>

    <AtlasDataTable
      :headers="headers"
      :items="items"
      item-value="id"
    >
      <template #item.name="{ item }">
        <a class="text-primary" style="cursor: pointer" @click="openResult(item.id)">{{ item.name }}</a>
      </template>
      <template #item.size="{ item }">{{ formatSize(item.size) }}</template>
      <template #item.addedAt="{ item }">{{ formatDate(item.addedAt) }}</template>
      <template #item.actions="{ item }">
        <AtlasIconButton
          :data-testid="`open-result-${item.id}`"
          icon="mdi-open-in-new"
          ariaLabel="Open result"
          size="sm"
          @click="openResult(item.id)"
        />
      </template>
      <template #no-data>No saved results — import one in the viewer</template>
    </AtlasDataTable>
  </AtlasPageShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AtlasPageShell, AtlasDataTable, AtlasIconButton, AtlasAlert } from '@ohdsi/atlas-ui';
import { listSavedResults, openResult, type ResultMeta } from '../data/results';

const items = ref<ResultMeta[]>([]);
const error = ref<string | null>(null);

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Size', key: 'size' },
  { title: 'Added', key: 'addedAt' },
  { title: '', key: 'actions', sortable: false },
];

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return isNaN(d.getTime()) ? String(ms) : d.toLocaleString();
}

function goToImport(): void {
  window.location.href = '/plugins/results-viewer/';
}

function reload(): void {
  error.value = null;
  try {
    items.value = listSavedResults();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(reload);
</script>
