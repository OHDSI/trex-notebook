<template>
  <div class="webapi-section">
    <AtlasAlert v-if="store.error" severity="danger" variant="tonal" class="mb-3">{{ store.error }}</AtlasAlert>
    <p class="text-medium-emphasis mb-3">
      Base URL of the OHDSI WebAPI Sibyl connects to for fetching cohorts (e.g. https://example.org/WebAPI).
    </p>
    <AtlasTextField v-model="url" label="WebAPI URL" placeholder="https://example.org/WebAPI" density="compact" data-test="webapi-url" />
    <div class="d-flex ga-2 align-center">
      <AtlasButton variant="primary" :loading="store.saving" data-test="webapi-save" @click="onSave">Save</AtlasButton>
      <AtlasButton variant="ghost" :loading="testing" data-test="webapi-test" @click="onTest">Test connection</AtlasButton>
      <AtlasChip v-if="testResult === 'ok'" tone="success" size="sm">Connected</AtlasChip>
      <AtlasChip v-else-if="testResult === 'fail'" tone="danger" size="sm">Unreachable</AtlasChip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { AtlasAlert, AtlasTextField, AtlasButton, AtlasChip } from '@ohdsi/atlas-ui'

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
