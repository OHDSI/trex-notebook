<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { pluginBase } from '../pluginBase'
import { AtlasIconButton } from '@ohdsi/atlas-ui'

const props = defineProps<{ files: Map<string, ArrayBuffer>; embedded?: boolean }>()
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CH))
  }
  return btoa(binary)
}

function trySendData() {
  const wins = getInnerFrames()
  if (wins.length === 0 || props.files.size === 0) return

  // Prefer a binary DuckDB results file if present: send it base64-chunked.
  let dbName: string | null = null
  for (const [name] of props.files) {
    if (name.endsWith('.db')) { dbName = name; break }
  }
  if (dbName) {
    const b64 = bytesToBase64(new Uint8Array(props.files.get(dbName)!))
    const DB_CHUNK = 512 * 1024
    const total = Math.ceil(b64.length / DB_CHUNK)
    for (const w of wins) w.postMessage({ type: 'RESULT_DB_BEGIN', total }, '*')
    for (let i = 0; i < total; i++) {
      const content = b64.slice(i * DB_CHUNK, (i + 1) * DB_CHUNK)
      for (const w of wins) w.postMessage({ type: 'RESULT_DB_CHUNK', index: i, total, content }, '*')
    }
    for (const w of wins) w.postMessage({ type: 'RESULT_DB_END', total }, '*')
    return
  }

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
    // The app only posts this once WebR/Shiny has finished booting — on a cold
    // first load that is 1–3 minutes, long after the initial blind send window
    // expired. Drive the send from this event (and keep retrying until the app
    // acks) so a late-booting app is always served. Without this, the overlay
    // sticks on "Sending result data…" forever.
    loadingMessage.value = 'Sending result data…'
    beginSending()
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

// Post the result data into the iframe and keep retrying until the app acks
// with DATA_RECEIVED. The retry must outlast WebR's cold-boot time (1–3 min),
// not a short fixed window: the app cannot receive anything until its Shiny
// runtime is up, and it announces that via SHINYLIVE_READY (which also calls
// this directly). Cleared on DATA_RECEIVED (onMessage) and on unmount.
function beginSending() {
  if (dataReceived || props.files.size === 0) return
  trySendData()
  if (sendInterval) return
  let attempts = 0
  const maxAttempts = 200 // ~10 min safety net; normally cleared far sooner by the ack
  sendInterval = setInterval(() => {
    attempts += 1
    if (dataReceived || attempts >= maxAttempts) {
      if (sendInterval) clearInterval(sendInterval)
      sendInterval = null
      return
    }
    trySendData()
  }, 3000)
}

function startSendCycle() {
  if (sendInterval) clearInterval(sendInterval)
  sendInterval = null
  if (props.files.size === 0) return
  dataReceived = false
  isReady.value = false
  loadStartedAt.value = Date.now()
  loadingMessage.value = 'Starting result viewer…'
  if (elapsedTimer) clearInterval(elapsedTimer)
  elapsedTimer = setInterval(() => {
    elapsedSec.value = Math.floor((Date.now() - loadStartedAt.value) / 1000)
  }, 1000)
  // Kick an initial (blind) send in case the app is already listening, then let
  // SHINYLIVE_READY re-drive it once the app finishes booting.
  beginSending()
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
    <AtlasIconButton
      v-if="!props.embedded"
      icon="mdi-arrow-left"
      ariaLabel="Back to library"
      size="sm"
      variant="tonal"
      tone="primary"
      :style="{ position: 'absolute', top: '32px', left: '32px', zIndex: 100 }"
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
  border-top-color: rgb(var(--v-theme-primary, 0, 0, 128));
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
