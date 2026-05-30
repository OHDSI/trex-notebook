<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { pluginBase } from '../pluginBase'

const props = defineProps<{ files: Map<string, ArrayBuffer> }>()
const emit = defineEmits<{ reset: [] }>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
// Bust shinylive service-worker cache by appending a build timestamp.
// Updated each Vite build so deploys can't be stuck behind a stale SW.
const iframeSrc = `${pluginBase()}shinylive/index.html?v=${__BUILD_ID__}`
let sendInterval: ReturnType<typeof setInterval> | null = null
let dataReceived = false

const isReady = ref(false)
const loadingMessage = ref('Starting result viewer…')
const loadStartedAt = ref(Date.now())
const elapsedSec = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null

function getInnerFrames(): Window[] {
  const outer = iframeRef.value
  if (!outer?.contentWindow) return []
  try {
    const inners = outer.contentWindow.document.querySelectorAll('iframe')
    const wins: Window[] = []
    for (const f of inners) {
      if (f.contentWindow) wins.push(f.contentWindow)
    }
    return wins.length > 0 ? wins : [outer.contentWindow]
  } catch {
    return outer.contentWindow ? [outer.contentWindow] : []
  }
}

function trySendData() {
  const wins = getInnerFrames()
  if (wins.length === 0 || props.files.size === 0) return
  const dec = new TextDecoder()
  const csvNames: string[] = []
  for (const [name] of props.files) {
    if (name.endsWith('.csv')) csvNames.push(name)
  }
  for (const w of wins) {
    w.postMessage({ type: 'RESULT_FILES_BEGIN', total: csvNames.length }, '*')
  }
  for (let i = 0; i < csvNames.length; i++) {
    const name = csvNames[i]
    const buf = props.files.get(name)!
    const content = dec.decode(buf)
    for (const w of wins) {
      w.postMessage({
        type: 'RESULT_FILES_CHUNK',
        name,
        content,
        index: i,
        total: csvNames.length,
      }, '*')
    }
  }
  for (const w of wins) {
    w.postMessage({ type: 'RESULT_FILES_END', total: csvNames.length }, '*')
  }
}

function onMessage(event: MessageEvent) {
  const t = event.data?.type
  if (t === 'SHINYLIVE_READY') {
    loadingMessage.value = 'Sending result data…'
    return
  }
  if (t === 'DATA_RECEIVED') {
    dataReceived = true
    loadingMessage.value = 'Loading tables into DB…'
    if (sendInterval) {
      clearInterval(sendInterval)
      sendInterval = null
    }
    return
  }
  if (t === 'APP_READY') {
    isReady.value = true
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
    return
  }
}

function startSendCycle() {
  if (sendInterval) clearInterval(sendInterval)
  if (props.files.size === 0) return
  dataReceived = false
  isReady.value = false
  loadStartedAt.value = Date.now()
  loadingMessage.value = 'Starting result viewer…'
  if (elapsedTimer) clearInterval(elapsedTimer)
  elapsedTimer = setInterval(() => {
    elapsedSec.value = Math.floor((Date.now() - loadStartedAt.value) / 1000)
  }, 1000)
  let attempts = 0
  const maxAttempts = 12
  trySendData()
  sendInterval = setInterval(() => {
    attempts += 1
    if (dataReceived || attempts >= maxAttempts) {
      if (sendInterval) clearInterval(sendInterval)
      sendInterval = null
      return
    }
    trySendData()
  }, 5000)
}

watch(() => props.files, () => { startSendCycle() }, { deep: false })

onMounted(() => {
  window.addEventListener('message', onMessage)
  startSendCycle()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  if (sendInterval) clearInterval(sendInterval)
  if (elapsedTimer) clearInterval(elapsedTimer)
})
</script>

<template>
  <div :style="{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }">
    <v-btn
      icon="mdi-arrow-left"
      size="x-small"
      variant="tonal"
      color="primary"
      density="compact"
      :style="{ position: 'absolute', top: '32px', left: '32px', zIndex: 100, width: '30px', height: '30px', minWidth: '30px' }"
      title="Back to library"
      @click="emit('reset')"
    />
    <iframe
      ref="iframeRef"
      :src="iframeSrc"
      title="Shiny application viewer"
      :style="{ width: '100%', height: '100%', border: 'none', display: 'block' }"
    />
    <div
      v-if="!isReady"
      class="rv-loading-overlay"
    >
      <div class="rv-loading-card">
        <div class="rv-spinner" />
        <div class="rv-loading-title">
          Loading OHDSI Result Viewer
        </div>
        <div class="rv-loading-msg">
          {{ loadingMessage }}
        </div>
        <div class="rv-loading-sub">
          {{ elapsedSec }}s elapsed · first load takes about 1–3 minutes while the R engine warms up
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.rv-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.97);
  z-index: 200;
  pointer-events: auto;
}
.rv-loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 40px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  background: #fff;
  min-width: 320px;
  text-align: center;
}
.rv-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #1976d2;
  border-radius: 50%;
  animation: rv-spin 1s linear infinite;
}
@keyframes rv-spin {
  to { transform: rotate(360deg); }
}
.rv-loading-title {
  font-size: 1.05rem;
  font-weight: 500;
  color: #1f2937;
  margin-top: 4px;
}
.rv-loading-msg {
  font-size: 0.9rem;
  color: #374151;
}
.rv-loading-sub {
  font-size: 0.78rem;
  color: #6b7280;
  margin-top: 4px;
}
</style>
