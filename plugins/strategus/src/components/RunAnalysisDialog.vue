<template>
  <AtlasDialog
    :model-value="open"
    eyebrow="RUN"
    title="Run analysis"
    :max-width="400"
    @close="$emit('close')"
    @update:model-value="val => { if (!val) $emit('close') }"
  >
    <p
      v-if="error"
      class="run-error"
      data-test="error"
    >
      {{ error }}
    </p>
    <label class="run-label">
      CDM schema
      <input
        v-model="cdmSchema"
        class="run-input"
        data-test="cdm"
      >
    </label>
    <label class="run-label">
      R environment
      <select
        v-model="envName"
        class="run-input"
        data-test="env"
      >
        <option
          v-for="e in envs"
          :key="e.envName"
          :value="e.envName"
        >
          {{ e.envName }}
        </option>
      </select>
    </label>
    <label class="run-label">
      Run name (optional)
      <input
        v-model="name"
        class="run-input"
        data-test="name"
      >
    </label>
    <template #actions>
      <AtlasButton
        variant="ghost"
        @click="$emit('close')"
      >
        Cancel
      </AtlasButton>
      <AtlasButton
        data-test="run"
        :disabled="!cdmSchema || !envName || busy"
        @click="submit"
      >
        Run
      </AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { AtlasDialog, AtlasButton } from '@ohdsi/atlas-ui';
import { HadesClient, defaultBase } from '../api/hadesClient';
import type { HadesEnv } from '../api/types';

const props = defineProps<{ open: boolean; spec: unknown }>();
const emit = defineEmits<{ close: []; submitted: [jobId: string] }>();

const client = new HadesClient(defaultBase());
const envs = ref<HadesEnv[]>([]);
const cdmSchema = ref('');
const envName = ref('');
const name = ref('');
const busy = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.open,
  async (o) => {
    if (!o) return;
    try {
      envs.value = await client.listEnvs();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  },
  { immediate: true }
);

async function submit(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const jobId = await client.execute({
      spec: props.spec,
      cdmSchema: cdmSchema.value,
      envName: envName.value,
      name: name.value || undefined,
    });
    emit('submitted', jobId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.run-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  margin-bottom: 12px;
}
.run-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.run-error {
  color: #c62828;
  margin-bottom: 8px;
}
</style>
