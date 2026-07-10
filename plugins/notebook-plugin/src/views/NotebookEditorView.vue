<template>
  <div class="notebook-editor studies-section-body">
    <button class="notebook-editor__back" @click="emit('back')">
      <AtlasIcon icon="mdi-arrow-left" size="16" />
      <span>Notebooks</span>
    </button>

    <SectionHero
      eyebrow="OHDSI · Notebook"
      :title="props.id ? 'Edit notebook' : 'New notebook'"
      subtitle="Write and run analytical cells against this site's data."
    >
      <template #actions>
        <AtlasChip v-if="dirty" tone="warning" size="sm">Unsaved</AtlasChip>
        <AtlasButton
          variant="primary"
          prepend-icon="mdi-content-save"
          :loading="saving"
          :disabled="!name"
          @click="save"
        >Save</AtlasButton>
      </template>
    </SectionHero>

    <div class="notebook-editor__meta">
      <AtlasTextField v-model="name" label="Name" class="notebook-editor__name" />
      <AtlasTextField
        v-model="description"
        label="Description"
        placeholder="Optional summary"
        class="notebook-editor__desc"
      />
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
import { AtlasAlert, AtlasButton, AtlasChip, AtlasIcon, AtlasTextField } from "@ohdsi/atlas-ui";
import SectionHero from "../components/SectionHero.vue";
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
/* Padded, scrollable body inside the shared notebook shell card — matches the
   Studies section body so both plugins share the same rhythm. */
.studies-section-body {
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
}
.notebook-editor__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.notebook-editor__back:hover { text-decoration: underline; }
.notebook-editor__meta {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.notebook-editor__name { flex: 0 0 320px; max-width: 320px; }
.notebook-editor__desc { flex: 1 1 360px; min-width: 240px; }
</style>
