<template>
  <div class="studies-section-body">
    <SectionHero eyebrow="OHDSI · Results" title="Results" subtitle="Imported study results — open one to explore it in the viewer">
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
        <a class="text-primary" style="cursor: pointer" @click="open(item)">{{ displayName(item.name) }}</a>
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
import SectionHero from '../components/SectionHero.vue';
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
.studies-section-body { padding: 20px 24px; }
</style>
