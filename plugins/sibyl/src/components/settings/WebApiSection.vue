<template>
  <div class="webapi-section">
    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-3">{{ store.error }}</v-alert>
    <p class="text-medium-emphasis mb-3">
      Base URL of the OHDSI WebAPI Sibyl connects to for fetching cohorts (e.g. https://example.org/WebAPI).
    </p>
    <v-text-field v-model="url" label="WebAPI URL" placeholder="https://example.org/WebAPI" density="compact" data-test="webapi-url" />
    <div class="d-flex ga-2 align-center">
      <v-btn color="primary" :loading="store.saving" data-test="webapi-save" @click="onSave">Save</v-btn>
      <v-btn variant="text" :loading="testing" data-test="webapi-test" @click="onTest">Test connection</v-btn>
      <v-chip v-if="testResult === 'ok'" color="success" size="small" variant="tonal">Connected</v-chip>
      <v-chip v-else-if="testResult === 'fail'" color="error" size="small" variant="tonal">Unreachable</v-chip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const store = useSettingsStore()
const url = ref('')
const testing = ref(false)
const testResult = ref<'ok' | 'fail' | null>(null)

async function onSave() {
  // store.save rethrows after recording store.error (shown in the alert above);
  // swallow here so the click handler doesn't produce an unhandled rejection.
  try { await store.save(url.value) } catch { /* surfaced via store.error */ }
}
async function onTest() {
  testing.value = true; testResult.value = null
  testResult.value = (await store.testConnection(url.value)) ? 'ok' : 'fail'
  testing.value = false
}
onMounted(async () => { await store.load(); url.value = store.webApiUrl })
</script>
