<template>
  <AtlasPageShell
    hero
    compact
    eyebrow="OHDSI · Notebooks"
    title="Notebooks"
    subtitle="Create and manage analytical notebooks for your cohort studies"
  >
    <template #actions>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="emit('new')">New notebook</v-btn>
    </template>

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
        <v-btn icon="mdi-pencil" variant="text" size="small" title="Rename" @click="openRename(item)" />
        <v-btn icon="mdi-content-copy" variant="text" size="small" title="Duplicate" @click="duplicate(item.rowId)" />
        <v-btn icon="mdi-delete" variant="text" size="small" title="Delete" @click="openDelete(item)" />
      </template>
      <template #no-data>No notebooks yet. Create one with "New notebook".</template>
    </v-data-table>

    <AtlasDialog v-model="renameDialog" eyebrow="RENAME" title="Rename notebook" :max-width="440" @close="renameDialog = false">
      <v-text-field
        v-model="renameName"
        label="Name"
        autofocus
        hide-details
        @keyup.enter="confirmRename"
      />
      <template #actions>
        <AtlasButton variant="ghost" @click="renameDialog = false">Cancel</AtlasButton>
        <AtlasButton :disabled="!renameName.trim()" @click="confirmRename">Rename</AtlasButton>
      </template>
    </AtlasDialog>

    <AtlasDialog v-model="deleteDialog" eyebrow="DELETE" title="Delete notebook" :max-width="440" @close="deleteDialog = false">
      Delete <strong>{{ deleteTarget?.name }}</strong>? This cannot be undone.
      <template #actions>
        <AtlasButton variant="ghost" @click="deleteDialog = false">Cancel</AtlasButton>
        <AtlasButton variant="danger" @click="confirmDelete">Delete</AtlasButton>
      </template>
    </AtlasDialog>
  </AtlasPageShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { AtlasPageShell, AtlasDialog, AtlasButton } from "@ohdsi/atlas-ui";
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

const renameDialog = ref(false);
const renameTarget = ref<NotebookSummary | null>(null);
const renameName = ref("");

function openRename(item: NotebookSummary): void {
  renameTarget.value = item;
  renameName.value = item.name;
  renameDialog.value = true;
}

async function confirmRename(): Promise<void> {
  const target = renameTarget.value;
  const name = renameName.value.trim();
  renameDialog.value = false;
  if (target && name && name !== target.name) await store.update(target.rowId, { name });
}

const deleteDialog = ref(false);
const deleteTarget = ref<NotebookSummary | null>(null);

function openDelete(item: NotebookSummary): void {
  deleteTarget.value = item;
  deleteDialog.value = true;
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value;
  deleteDialog.value = false;
  if (target) await store.remove(target.rowId);
}

async function duplicate(id: string): Promise<void> {
  await store.duplicate(id);
}

onMounted(reload);
</script>

