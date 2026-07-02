<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import ResultsLibrary from './components/ResultsLibrary.vue'
import ShinyFrame from './components/ShinyFrame.vue'

defineProps<{
  name: string
  authContext: unknown
  messageBus: unknown
}>()

// The actual stable Map we pass to ShinyFrame. Updated by reference only
// when the user uploads new data, so the watch in ShinyFrame doesn't refire
// unnecessarily. shallowRef avoids deep-tracking Map contents.
const filesForViewer = shallowRef<Map<string, ArrayBuffer>>(new Map())
const hasLoadedData = ref(false)
const hasMountedShiny = ref(false)
const phase = ref<'loader' | 'viewer'>('loader')

// Remount ShinyFrame (fresh WebR/Shiny session) whenever a *different* dataset
// is opened. The OHDSI module servers initialise once and guard re-entry
// (OhdsiShinyAppBuilder's runServer==1), so re-posting new files into a live
// session reloads the DuckDB tables but leaves the modules bound to the first
// dataset — the viewer then renders empty/stale. Keying the frame by dataset
// identity forces a clean re-init on switch; re-opening the same result keeps
// the existing session (no needless WebR cold-start).
const frameKey = ref(0)
let lastSig = ''

function datasetSignature(files: Map<string, ArrayBuffer>): string {
  return Array.from(files.entries())
    .map(([n, b]) => `${n}:${b.byteLength}`)
    .sort()
    .join('|')
}

function onDataLoaded(files: Map<string, ArrayBuffer>) {
  const sig = datasetSignature(files)
  if (sig !== lastSig) {
    lastSig = sig
    frameKey.value++
  }
  filesForViewer.value = files
  hasLoadedData.value = true
  hasMountedShiny.value = true
  phase.value = 'viewer'
}

function onReset() {
  // Switch back to loader, but keep ShinyFrame mounted and don't touch
  // filesForViewer — the existing data stays in the iframe.
  phase.value = 'loader'
}
</script>

<template>
  <div class="results-viewer">
    <ResultsLibrary
      v-show="phase === 'loader'"
      @loaded="onDataLoaded"
    />
    <ShinyFrame
      v-if="hasMountedShiny"
      v-show="phase === 'viewer'"
      :key="frameKey"
      :files="filesForViewer"
      @reset="onReset"
    />
  </div>
</template>

<style scoped>
.results-viewer {
  width: 100%;
  height: calc(100vh - 64px);
  /* The iframe inside scrolls its own content; the outer wrapper must not
   * also scroll — otherwise the user sees two scrollbars stacked. */
  overflow: hidden;
}
</style>
