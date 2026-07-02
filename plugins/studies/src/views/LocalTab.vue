<template>
  <AtlasPageShell
    hero
    compact
    eyebrow="OHDSI · Studies"
    title="Local"
    subtitle="Studies running against this site's local data"
  >
    <template #actions>
      <AtlasIconButton icon="mdi-cog-outline" ariaLabel="Connections" size="sm" @click="goToConnections" />
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
import { ref, onMounted } from 'vue';
import { AtlasPageShell, AtlasDataTable, AtlasIconButton, AtlasAlert } from '@ohdsi/atlas-ui';
import { listLocalItems, type LocalItem } from '../data/local';

const items = ref<LocalItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

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
  window.location.href = item.route;
}

function goToConnections(): void {
  window.location.href = '/plugins/jobs-plugin/';
}

onMounted(reload);
</script>
