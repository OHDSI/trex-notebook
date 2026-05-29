<template>
  <div class="plugin-container">
    <div
      :id="pluginContainerId"
      class="plugin-mount-point"
      :class="{ 'plugin-mount-point--hidden': hasError || isLoading }"
    />
    <div v-if="hasError" class="plugin-overlay">
      <div class="plugin-state">
        <p class="plugin-state__title">Failed to load “{{ pluginId }}”</p>
        <p v-if="error" class="plugin-state__msg">{{ error.message }}</p>
        <button class="plugin-state__btn" @click="handleRetry">Retry</button>
      </div>
    </div>
    <div v-else-if="isLoading" class="plugin-overlay">
      <div class="plugin-state">
        <p class="plugin-state__title">Loading “{{ pluginId }}”…</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, onErrorCaptured } from 'vue'
import { useRoute } from 'vue-router'
import { pluginRegistry } from '@/plugins/index'
import { logger } from '@/utils/logger'

const route = useRoute()
const pluginId = computed(() => route.params.pluginId as string)
const pluginContainerId = computed(() => `plugin-${pluginId.value}`)

const hasError = ref(false)
const error = ref<{ message: string; stack?: string; timestamp: Date; recoverable: boolean } | null>(null)
const isLoading = ref(true)

let stateUnsubscribe: (() => void) | null = null

async function initForPlugin() {
  const targetId = pluginId.value

  // Reset to initial loading state for the new plugin.
  hasError.value = false
  error.value = null
  isLoading.value = true

  // Tear down any existing subscription before re-subscribing.
  stateUnsubscribe?.()
  stateUnsubscribe = null

  let plugin = null
  for (let attempt = 0; attempt < 20; attempt++) {
    plugin = pluginRegistry.getPlugin(targetId)
    if (plugin) break
    await new Promise(resolve => setTimeout(resolve, 100))
    // A newer init may have started while we awaited; bail out if so.
    if (pluginId.value !== targetId) return
  }

  // Guard against a stale poll subscribing for the wrong id.
  if (pluginId.value !== targetId) return

  if (plugin) {
    stateUnsubscribe = pluginRegistry.onStateChange(targetId, state => {
      hasError.value = state === 'error'
      isLoading.value = state === 'loading' || state === 'not-loaded'
      error.value = pluginRegistry.getPlugin(targetId)?.error ?? null
    })
  } else {
    logger.error('PluginContainer', `Plugin ${targetId} not found`)
    hasError.value = true
    isLoading.value = false
    error.value = { message: `Plugin ${targetId} not found`, timestamp: new Date(), recoverable: false }
  }
}

onMounted(() => {
  initForPlugin()
})

watch(pluginId, () => {
  initForPlugin()
})

onUnmounted(() => {
  if (stateUnsubscribe) stateUnsubscribe()
})

onErrorCaptured(err => {
  logger.error('PluginContainer', `Error captured for plugin ${pluginId.value}`, err)
  hasError.value = true
  error.value = { message: err.message, stack: err.stack, timestamp: new Date(), recoverable: true }
  return false
})

function handleRetry() {
  hasError.value = false
  error.value = null
  window.__pluginLoader?.retryPlugin(pluginId.value)
}
</script>

<style scoped>
.plugin-container { width: 100%; height: 100%; position: relative; }
.plugin-mount-point { width: 100%; height: 100%; }
.plugin-mount-point--hidden { visibility: hidden; position: absolute; top: 0; left: 0; }
.plugin-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  min-height: 400px; background: #fff; z-index: 10;
}
.plugin-state { text-align: center; }
.plugin-state__title { font-weight: 600; }
.plugin-state__msg { color: #b00020; margin-top: 0.5rem; }
.plugin-state__btn {
  margin-top: 1rem; padding: 0.5rem 1rem; border: none; border-radius: 6px;
  background: #1f425a; color: #fff; cursor: pointer;
}
</style>
