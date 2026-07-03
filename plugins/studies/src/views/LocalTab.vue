<template>
  <div class="studies-overview">
    <header class="studies-overview__head">
      <div>
        <h1 class="text-h4">Overview</h1>
        <p class="text-subtitle-1">Studies and notebooks running against this site's local data</p>
      </div>
      <div class="studies-overview__actions">
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
      <template #item.updatedAt="{ item }">{{ formatDate(item.updatedAt) }}</template>
      <template #no-data>No local studies or notebooks yet</template>
    </AtlasDataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted } from 'vue';
import { AtlasDataTable, AtlasAlert, AtlasButton } from '@ohdsi/atlas-ui';
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

<style scoped>
.studies-overview {
  padding: 28px 32px;
}
.studies-overview__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.studies-overview__head h1.text-h4 {
  font-size: 34px;
  font-weight: 300;
  line-height: 1.2;
  color: rgb(31, 66, 90);
}
.studies-overview__head .text-subtitle-1 {
  font-size: 14px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.62);
  margin-top: 2px;
}
.studies-overview__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
