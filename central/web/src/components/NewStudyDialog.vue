<template>
  <v-dialog v-model="open" max-width="560">
    <template #activator="{ props }">
      <v-btn v-bind="props" prepend-icon="mdi-plus">New study</v-btn>
    </template>
    <v-card class="pa-4">
      <v-card-title>New study</v-card-title>
      <v-card-text>
        <v-text-field v-model="name" label="Name" />
        <v-text-field v-model="version" label="Version" />
        <v-textarea v-model="description" label="Description" rows="2" />
        <v-file-input v-model="strategus" label="strategus.json" accept=".json" />
        <v-file-input v-model="renvLock" label="renv.lock" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :loading="busy" :disabled="!canSubmit" @click="submit">Create draft</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStudiesStore } from '../stores/studies';

const emit = defineEmits<{ created: [] }>();
const store = useStudiesStore();
const open = ref(false);
const busy = ref(false);
const name = ref('');
const version = ref('1.0.0');
const description = ref('');
const strategus = ref<File | File[] | null>(null);
const renvLock = ref<File | File[] | null>(null);

const one = (f: File | File[] | null): File | null => (Array.isArray(f) ? f[0] ?? null : f);
const canSubmit = computed(() => !!name.value && !!one(strategus.value) && !!one(renvLock.value));

async function submit() {
  const s = one(strategus.value);
  const r = one(renvLock.value);
  if (!s || !r) return;
  busy.value = true;
  try {
    await store.createWithUploads(
      { name: name.value, description: description.value, version: version.value },
      s,
      r,
    );
    emit('created');
    open.value = false;
  } finally {
    busy.value = false;
  }
}
</script>
