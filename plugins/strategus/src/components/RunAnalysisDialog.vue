<template>
  <div
    v-if="open"
    class="run-dialog"
  >
    <h3>Run analysis</h3>
    <p
      v-if="error"
      class="error"
      data-test="error"
    >
      {{ error }}
    </p>
    <label>CDM schema
      <input
        v-model="cdmSchema"
        data-test="cdm"
      >
    </label>
    <label>R environment
      <select
        v-model="envName"
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
    <label>Run name (optional)
      <input
        v-model="name"
        data-test="name"
      >
    </label>
    <div class="actions">
      <button @click="$emit('close')">
        Cancel
      </button>
      <button
        data-test="run"
        :disabled="!cdmSchema || !envName || busy"
        @click="submit"
      >
        Run
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
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
.run-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  min-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.run-dialog label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.run-dialog input,
.run-dialog select {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.error {
  color: #c62828;
}
</style>
