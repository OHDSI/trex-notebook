<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    temporary
    width="900"
    data-test="jobs-panel"
  >
    <div class="d-flex align-center justify-space-between pa-4">
      <span class="text-h6">Jobs</span>
      <v-btn icon="mdi-close" variant="text" data-test="jobs-close" @click="ui.closeJobs()" />
    </div>
    <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>
    <div ref="mountEl" class="jobs-parcel-mount" />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { Parcel } from 'single-spa'
import { useUiStore } from '@/stores/ui'
import { mountPluginParcel } from '@/plugins/core/PluginParcel'
import { JOBS_PLUGIN_ID } from '@/plugins/navigation/PluginMenuIntegration'

const ui = useUiStore()
const open = computed({ get: () => ui.jobsOpen, set: v => { if (!v) ui.closeJobs() } })
const mountEl = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
let parcel: Parcel | null = null

async function unmountParcel() {
  if (parcel) { try { await parcel.unmount() } catch { /* ignore */ } parcel = null }
}

watch(() => ui.jobsOpen, async (isOpen) => {
  if (isOpen) {
    error.value = null
    // Wait a tick so the drawer's mount element exists in the DOM.
    await new Promise(r => requestAnimationFrame(() => r(null)))
    if (!mountEl.value) return
    try { parcel = await mountPluginParcel(JOBS_PLUGIN_ID, mountEl.value) }
    catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  } else {
    await unmountParcel()
  }
})

onBeforeUnmount(unmountParcel)
</script>

<style scoped>
.jobs-parcel-mount { height: calc(100% - 72px); overflow: auto; }
</style>
