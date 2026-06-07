<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    temporary
    :width="drawerWidth"
    data-test="jobs-panel"
  >
    <div class="d-flex align-center justify-space-between pa-4">
      <span class="text-h6">Jobs</span>
      <v-btn icon="mdi-close" variant="text" aria-label="Close jobs panel" data-test="jobs-close" @click="ui.closeJobs()" />
    </div>
    <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>
    <div ref="mountEl" class="jobs-parcel-mount" />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import type { Parcel } from 'single-spa'
import { useUiStore } from '@/stores/ui'
import { useDrawerWidth } from '@/composables/useDrawerWidth'
import { mountPluginParcel } from '@/plugins/core/PluginParcel'
import { JOBS_PLUGIN_ID } from '@/plugins/navigation/PluginMenuIntegration'

const ui = useUiStore()
const drawerWidth = useDrawerWidth()
const open = computed({ get: () => ui.jobsOpen, set: v => { if (!v) ui.closeJobs() } })
const mountEl = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
let parcel: Parcel | null = null
// Monotonic token: each open/close bumps it so an in-flight async mount can tell
// it has been superseded (rapid open→close→open) and avoid leaking a parcel.
let mountSeq = 0

async function unmountParcel() {
  if (parcel) { try { await parcel.unmount() } catch { /* ignore */ } parcel = null }
}

watch(() => ui.jobsOpen, async (isOpen) => {
  if (isOpen) {
    const seq = ++mountSeq
    error.value = null
    // Wait for Vue's DOM commit then a paint tick so the drawer's mount element exists.
    await nextTick()
    await new Promise(r => requestAnimationFrame(() => r(null)))
    if (seq !== mountSeq || !mountEl.value) return
    try {
      const p = await mountPluginParcel(JOBS_PLUGIN_ID, mountEl.value)
      // Panel was closed/reopened while SystemJS import was in flight — discard.
      if (seq !== mountSeq) { try { await p.unmount() } catch { /* ignore */ } return }
      parcel = p
    } catch (e) {
      if (seq === mountSeq) error.value = e instanceof Error ? e.message : String(e)
    }
  } else {
    mountSeq++ // invalidate any in-flight mount started by the matching open
    await unmountParcel()
  }
})

onBeforeUnmount(() => { mountSeq++; void unmountParcel() })
</script>

<style scoped>
.jobs-parcel-mount { height: calc(100% - 72px); overflow: auto; }
</style>
