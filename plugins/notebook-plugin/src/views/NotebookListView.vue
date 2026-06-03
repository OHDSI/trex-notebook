<template>
  <div class="notebook-list">
    <div class="d-flex align-center mb-4">
      <h2 class="text-h6">Notebooks</h2>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="emit('new')">New notebook</v-btn>
    </div>

    <v-alert v-if="store.error" type="error" class="mb-4">{{ store.error }}</v-alert>

    <v-data-table
      :headers="headers"
      :items="store.notebooks"
      :loading="loading"
      item-value="rowId"
      density="comfortable"
    >
      <template #item.name="{ item }">
        <a class="text-primary" style="cursor: pointer" @click="emit('open', item.rowId)">{{ item.name }}</a>
      </template>
      <template #item.updatedAt="{ item }">{{ formatDate(item.updatedAt) }}</template>
      <template #item.actions="{ item }">
        <v-btn icon="mdi-pencil" variant="text" size="small" title="Rename" @click="rename(item)" />
        <v-btn icon="mdi-content-copy" variant="text" size="small" title="Duplicate" @click="duplicate(item.rowId)" />
        <v-btn icon="mdi-delete" variant="text" size="small" title="Delete" @click="remove(item)" />
      </template>
      <template #no-data>No notebooks yet. Create one with "New notebook".</template>
    </v-data-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useNotebooksStore } from "../store/useNotebooksStore";
import type { NotebookSummary } from "../api/types";

const emit = defineEmits<{ (e: "open", id: string): void; (e: "new"): void }>();

const store = useNotebooksStore();
const loading = ref(false);

const headers = [
  { title: "Name", key: "name" },
  { title: "Description", key: "description" },
  { title: "Updated", key: "updatedAt" },
  { title: "", key: "actions", sortable: false, align: "end" as const },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

async function reload(): Promise<void> {
  loading.value = true;
  await store.fetch();
  loading.value = false;
}

async function rename(item: NotebookSummary): Promise<void> {
  const name = window.prompt("Rename notebook", item.name);
  if (name && name !== item.name) await store.update(item.rowId, { name });
}

async function duplicate(id: string): Promise<void> {
  await store.duplicate(id);
}

async function remove(item: NotebookSummary): Promise<void> {
  if (window.confirm(`Delete "${item.name}"?`)) await store.remove(item.rowId);
}

onMounted(reload);
</script>

<style scoped>
.notebook-list { padding: 4px; }
</style>
