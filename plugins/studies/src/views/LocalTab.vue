<template>
  <AtlasPageShell
    hero
    compact
    eyebrow="OHDSI · Studies"
    title="Local"
    subtitle="Studies running against this site's local data"
  >
    <template #actions>
      <AtlasButton
        variant="ghost"
        prepend-icon="mdi-notebook-plus-outline"
        @click="navigate('/plugins/notebook-plugin/?new=1')"
      >
        New Notebook
      </AtlasButton>
      <AtlasButton
        variant="primary"
        prepend-icon="mdi-flask-plus-outline"
        @click="navigate('/plugins/strategus-plugin/?new=1')"
      >
        New Study
      </AtlasButton>
    </template>

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
      <template #item.updatedAt="{ item }">{{ formatDate(item.updatedAt) }}</template>
      <template #no-data>No local studies</template>
    </AtlasDataTable>
  </AtlasPageShell>
</template>

<script setup lang="ts">
import { ref, inject, onMounted } from 'vue';
import { AtlasPageShell, AtlasDataTable, AtlasAlert, AtlasButton } from '@ohdsi/atlas-ui';
import { listLocalItems, type LocalItem } from '../data/local';
import type { StudiesHostCtx } from '../main';

const hostCtx = inject<StudiesHostCtx>('studiesHostCtx');

const items = ref<LocalItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Navigation goes through the host message bus (not window.location, which
// 404s under the /atlas/ base) so the SPA router applies the correct base.
function navigate(path: string): void {
  hostCtx?.messageBus.send('navigation:request', { path });
}

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'type' },
  { title: 'Updated', key: 'updatedAt' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

async function reload(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await listLocalItems();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function open(item: LocalItem): void {
  navigate(item.route);
}

onMounted(reload);
</script>
