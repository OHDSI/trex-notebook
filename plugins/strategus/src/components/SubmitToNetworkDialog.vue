<template>
  <AtlasDialog
    :model-value="open"
    eyebrow="SUBMIT"
    title="Submit to network"
    :max-width="480"
    @close="$emit('close')"
    @update:model-value="val => { if (!val) $emit('close') }"
  >
    <p
      v-if="error"
      class="submit-error"
      data-test="error"
    >
      {{ error }}
    </p>
    <label class="submit-label">
      Name
      <input
        v-model="name"
        class="submit-input"
        data-test="name"
      >
    </label>
    <label class="submit-label">
      Description
      <textarea
        v-model="description"
        class="submit-textarea"
        data-test="description"
        rows="3"
      />
    </label>
    <label class="submit-label">
      Version
      <input
        v-model="version"
        class="submit-input"
        data-test="version"
      >
    </label>
    <label class="submit-label">
      renv.lock
      <textarea
        v-model="renvLock"
        class="submit-textarea submit-textarea--lock"
        data-test="renv-lock"
        rows="6"
        placeholder="Paste the study's renv.lock content"
      />
    </label>
    <template #actions>
      <AtlasButton
        variant="ghost"
        @click="$emit('close')"
      >
        Cancel
      </AtlasButton>
      <AtlasButton
        data-test="submit"
        :disabled="!name.trim() || !version.trim() || !renvLock.trim() || busy"
        :loading="busy"
        @click="submit"
      >
        Submit
      </AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { AtlasDialog, AtlasButton } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';
import { serializeSpec } from '../services/SpecSerializer';
import { publishStudy } from '../api/networkClient';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; submitted: [] }>();

const store = useStrategusStore();
const name = ref('');
const description = ref('');
const version = ref('1.0.0');
const renvLock = ref('');
const busy = ref(false);
const error = ref<string | null>(null);

// Reset the form to the current study's defaults each time the dialog opens,
// so a stale name/description from a previous submit never lingers.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    name.value = store.studyName || '';
    description.value = store.description || '';
    version.value = '1.0.0';
    renvLock.value = '';
    error.value = null;
  },
  { immediate: true }
);

async function submit(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const specJson = JSON.stringify(
      serializeSpec(store as unknown as Parameters<typeof serializeSpec>[0]),
      null,
      2
    );
    await publishStudy({
      name: name.value.trim(),
      description: description.value,
      version: version.value.trim(),
      specJson,
      renvLock: renvLock.value,
    });
    emit('submitted');
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.submit-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  margin-bottom: 12px;
}
.submit-input,
.submit-textarea {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
}
.submit-textarea--lock {
  font-family: monospace;
  font-size: 12px;
}
.submit-error {
  color: #c62828;
  margin-bottom: 8px;
}
</style>
