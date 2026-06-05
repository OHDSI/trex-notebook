<template>
  <div class="notebook-editor">
    <div class="d-flex align-center mb-3" style="gap: 8px;">
      <AtlasIconButton icon="mdi-arrow-left" ariaLabel="Back" @click="emit('back')" />
      <AtlasTextField
        v-model="name"
        label="Name"
        style="max-width: 320px;"
      />
      <AtlasTextField
        v-model="description"
        label="Description"
      />
      <AtlasSpacer />
      <AtlasChip v-if="dirty" tone="warning" size="sm">Unsaved</AtlasChip>
      <AtlasButton variant="primary" :loading="saving" :disabled="!name" @click="save">Save</AtlasButton>
    </div>

    <AtlasAlert v-if="error" severity="danger" class="mb-3">{{ error }}</AtlasAlert>

    <Notebook
      v-if="ready"
      :initial-data="initialData"
      :kernels="kernels"
      :default-kernel-config="{ type: 'pyodide' }"
      :on-change="onChange"
    />
    <div v-else class="text-medium-emphasis">Loading…</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, shallowRef } from "vue";
import {
  Notebook,
  PyodideKernel,
  WebRKernel,
  createEmptyNotebook,
} from "@trex/notebook";
import type { NotebookData } from "@trex/notebook";
import { AtlasAlert, AtlasButton, AtlasChip, AtlasIconButton, AtlasSpacer, AtlasTextField } from "@ohdsi/atlas-ui";
import { useNotebooksStore } from "../store/useNotebooksStore";

const props = defineProps<{ id: string | null }>();
const emit = defineEmits<{ (e: "back"): void; (e: "saved", id: string): void }>();

const store = useNotebooksStore();
const kernels = [new PyodideKernel(), new WebRKernel()];

const ready = ref(false);
const saving = ref(false);
const dirty = ref(false);
const error = ref<string | null>(null);
const name = ref("Untitled notebook");
const description = ref("");
const initialData = shallowRef<NotebookData>(createEmptyNotebook());
const current = shallowRef<NotebookData>(initialData.value);
const docId = ref<string | null>(props.id);

function onChange(data: NotebookData): void {
  current.value = data;
  dirty.value = true;
}

watch([name, description], () => {
  if (ready.value) dirty.value = true;
});

async function load(): Promise<void> {
  if (props.id) {
    try {
      const doc = await store.get(props.id);
      name.value = doc.name;
      description.value = doc.description;
      initialData.value = doc.content;
      current.value = doc.content;
      docId.value = doc.rowId;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }
  ready.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    if (docId.value) {
      await store.update(docId.value, {
        name: name.value,
        description: description.value,
        content: current.value,
      });
    } else {
      docId.value = await store.create({
        name: name.value,
        description: description.value,
        content: current.value,
      });
    }
    dirty.value = false;
    emit("saved", docId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.notebook-editor { padding: 4px; }
</style>
