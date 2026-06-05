<template>
  <div>
    <h2 class="text-h6 mb-3">Submit results</h2>
    <AtlasSelect v-model="studyId" :items="studyItems" label="Study" item-title="title" item-value="value" />
    <v-file-input v-model="files" label="Result .db files" accept=".db" multiple />
    <AtlasButton :disabled="!canSubmit" :loading="busy" @click="submit">Submit</AtlasButton>
    <AtlasAlert v-if="message" :severity="error ? 'danger' : 'success'" variant="tonal" class="mt-4">
      {{ message }}
    </AtlasAlert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { AtlasAlert, AtlasButton, AtlasSelect } from '@ohdsi/atlas-ui';
import { useNetworkStore } from '../store/useNetworkStore';

const store = useNetworkStore();
const studyId = ref('');
const files = ref<File[]>([]);
const busy = ref(false);
const message = ref('');
const error = ref(false);

onMounted(() => void store.loadStudies());

const studyItems = computed(() =>
  store.studies.map((s) => ({ title: `${s.name} (${s.version})`, value: s.studyId })),
);
const canSubmit = computed(() => !!studyId.value && files.value.length > 0);

async function submit() {
  busy.value = true;
  message.value = '';
  error.value = false;
  try {
    const sub = await store.submit(studyId.value, files.value);
    message.value = `Submitted version ${sub.version}.`;
    files.value = [];
  } catch (e) {
    error.value = true;
    message.value = e instanceof Error ? e.message : 'submission failed';
  } finally {
    busy.value = false;
  }
}
</script>
