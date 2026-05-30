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

function onDataLoaded(files: Map<string, ArrayBuffer>) {
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
