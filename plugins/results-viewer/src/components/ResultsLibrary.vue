<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import JSZip from 'jszip'
import {
  listResults, addResult, deleteResult, getResultBlob, exportResult,
  type ResultMeta,
} from '../composables/useResultsLibrary'

const emit = defineEmits<{
  loaded: [files: Map<string, ArrayBuffer>]
}>()

const items = ref<ResultMeta[]>([])
const loading = ref(false)
const progress = ref('')
const error = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const hasItems = computed(() => items.value.length > 0)

onMounted(async () => {
  items.value = await listResults()
})

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function triggerImport() {
  fileInputRef.value?.click()
}

async function onImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await importAndOpen(file)
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function importAndOpen(file: File) {
  loading.value = true
  error.value = ''
  try {
    progress.value = 'Saving to library…'
    const meta = await addResult(file)
    items.value = [meta, ...items.value]
    progress.value = 'Opening…'
    await openMeta(meta)
  } catch (e) {
    error.value = `Could not import file: ${(e as Error).message}`
  } finally {
    loading.value = false
    progress.value = ''
  }
}

async function openMeta(meta: ResultMeta) {
  loading.value = true
  progress.value = `Loading ${meta.name}…`
  try {
    const blob = await getResultBlob(meta.id)
    if (!blob) throw new Error('File no longer in storage')
    const arr = await blob.arrayBuffer()
    const zip = await JSZip.loadAsync(arr)
    const map = new Map<string, ArrayBuffer>()
    const entries = Object.entries(zip.files).filter(([, f]) => !f.dir)
    for (let i = 0; i < entries.length; i++) {
      const [name, f] = entries[i]
      progress.value = `Extracting ${i + 1} / ${entries.length}`
      map.set(name, await f.async('arraybuffer'))
    }
    emit('loaded', map)
  } catch (e) {
    error.value = `Could not open: ${(e as Error).message}`
  } finally {
    // Always reset — otherwise the spinner survives the route change and the
    // user sees "Extracting 149 / 149" frozen on the library when they return.
    loading.value = false
    progress.value = ''
  }
}

async function onDelete(meta: ResultMeta) {
  if (!confirm(`Delete "${meta.name}" from the library?`)) return
  await deleteResult(meta.id)
  items.value = items.value.filter(m => m.id !== meta.id)
}

async function onExport(meta: ResultMeta) {
  await exportResult(meta.id)
}

function onDragOver(e: DragEvent) { e.preventDefault() }

async function onDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file) await importAndOpen(file)
}
</script>

<template>
  <!-- The page acts as a drop zone for ZIP uploads. ARIA has no standard
       role for drop zones; keyboard users have the Import button instead. -->
  <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
  <div
    class="rv-page"
    role="region"
    aria-label="Analysis results library, drop a ZIP to import"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <div class="rv-card">
      <!-- Atlas hero-style header -->
      <header class="rv-header">
        <div class="rv-header-text">
          <div class="rv-eyebrow-row">
            <span class="rv-eyebrow">OHDSI · Strategus</span>
            <span class="rv-accent-rule" />
          </div>
          <h1 class="rv-title">
            Analysis Results
          </h1>
          <p class="rv-subtitle">
            Saved Strategus result exports. Open a result to view it in the
            HADES viewer; import to add a new ZIP; export to download any
            stored result.
          </p>
        </div>
        <div class="rv-header-actions">
          <v-btn
            color="primary"
            variant="flat"
            size="default"
            prepend-icon="mdi-upload"
            :disabled="loading"
            @click.stop="triggerImport"
          >
            Import Result
          </v-btn>
          <input
            ref="fileInputRef"
            type="file"
            accept=".zip"
            aria-label="Import Strategus result ZIP"
            style="display:none"
            @change="onImport"
          >
        </div>
      </header>

      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="rv-alert"
        closable
        @click:close="error = ''"
      >
        {{ error }}
      </v-alert>

      <!-- Body -->
      <section class="rv-body">
        <div
          v-if="loading"
          class="rv-loading"
        >
          <v-progress-circular
            indeterminate
            color="primary"
            size="36"
            width="3"
          />
          <div class="rv-loading-text">
            {{ progress }}
          </div>
        </div>

        <div
          v-else-if="!hasItems"
          class="rv-empty"
        >
          <v-icon
            icon="mdi-folder-open-outline"
            size="48"
            color="grey-lighten-1"
          />
          <div class="rv-empty-title">
            No results yet
          </div>
          <div class="rv-empty-sub">
            Import a Strategus result ZIP to get started.
            You can also drop a file anywhere on this page.
          </div>
          <v-btn
            class="mt-4"
            color="primary"
            variant="flat"
            prepend-icon="mdi-upload"
            @click.stop="triggerImport"
          >
            Import Result
          </v-btn>
        </div>

        <div
          v-else
          class="rv-table"
        >
          <div class="rv-row rv-row-head">
            <div class="rv-col rv-col-name">
              Name
            </div>
            <div class="rv-col rv-col-size">
              Size
            </div>
            <div class="rv-col rv-col-date">
              Added
            </div>
            <div class="rv-col rv-col-actions" />
          </div>
          <div
            v-for="item in items"
            :key="item.id"
            class="rv-row rv-row-item"
            role="button"
            tabindex="0"
            :aria-label="`Open result ${item.name}`"
            @click="openMeta(item)"
            @keydown.enter.prevent="openMeta(item)"
            @keydown.space.prevent="openMeta(item)"
          >
            <div class="rv-col rv-col-name">
              <v-icon
                icon="mdi-database-outline"
                color="primary"
                size="20"
              />
              <span class="rv-row-name-text">{{ item.name }}</span>
            </div>
            <div class="rv-col rv-col-size">
              {{ fmtSize(item.size) }}
            </div>
            <div class="rv-col rv-col-date">
              {{ fmtDate(item.addedAt) }}
            </div>
            <div
              class="rv-col rv-col-actions"
              @click.stop
            >
              <v-btn
                size="small"
                variant="text"
                icon="mdi-download"
                title="Export ZIP"
                @click.stop="onExport(item)"
              />
              <v-btn
                size="small"
                variant="text"
                icon="mdi-delete-outline"
                color="error"
                title="Delete from library"
                @click.stop="onDelete(item)"
              />
              <v-btn
                size="small"
                variant="flat"
                color="primary"
                @click.stop="openMeta(item)"
              >
                Open
              </v-btn>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Mirror AtlasPageShell visual rhythm without importing Atlas3 components. */
.rv-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  padding: 24px;
  box-sizing: border-box;
  background: rgb(241, 243, 246);  /* surface-variant approximation */
}

/* Atlas-look buttons inside the library — scoped, no global theme leak.
 * Vuetify renders <button class="v-btn"...>; we paint over the bits that
 * look generic so the buttons match Atlas without touching Vuetify theme. */
.rv-page :deep(.v-btn) {
  text-transform: none !important;
  letter-spacing: 0 !important;
  border-radius: 8px !important;
  font-weight: 500 !important;
}
.rv-page :deep(.v-btn.text-primary),
.rv-page :deep(.v-btn--variant-flat.bg-primary) {
  background-color: #1f425a !important;
  color: #ffffff !important;
}
.rv-page :deep(.v-btn--variant-flat.bg-primary:hover) {
  background-color: #163349 !important;
}
.rv-page :deep(.v-btn--variant-text.text-primary),
.rv-page :deep(.v-btn--variant-text) {
  color: #1f425a !important;
}
.rv-page :deep(.v-btn--variant-text.text-error) {
  color: #ff5252 !important;
}
.rv-card {
  width: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 1px 3px rgba(15, 23, 42, 0.06);
  border: 1px solid #e5e7eb;
  padding: 28px 32px 32px;
  align-self: flex-start;
}

/* Header: Atlas hero pattern (eyebrow row + orange accent + light-weight title) */
.rv-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 22px;
}
.rv-header-text { flex: 1; min-width: 0; }
.rv-header-actions { flex-shrink: 0; display: flex; gap: 8px; }

.rv-eyebrow-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.rv-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7280;
}
.rv-accent-rule {
  display: inline-block;
  width: 28px;
  height: 2px;
  background: #eb6622;  /* Atlas orange */
  border-radius: 2px;
}
.rv-title {
  font-size: 26px;
  font-weight: 300;
  line-height: 1.2;
  color: #14365b;  /* Atlas primary navy */
  letter-spacing: 0.01em;
  margin: 0;
}
.rv-subtitle {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  margin: 4px 0 0;
  max-width: 640px;
}

.rv-alert { margin-bottom: 16px; border-radius: 10px; }

/* Empty / loading states */
.rv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 16px;
  text-align: center;
  color: #6b7280;
}
.rv-empty-title {
  font-size: 1.05rem;
  font-weight: 500;
  color: #1f2937;
  margin-top: 12px;
}
.rv-empty-sub {
  max-width: 420px;
  font-size: 0.9rem;
  margin-top: 6px;
}
.rv-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 16px;
  gap: 12px;
}
.rv-loading-text { font-size: 0.9rem; color: #374151; }

/* Table-style list */
.rv-table {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.rv-row {
  display: grid;
  grid-template-columns: 1fr 100px 200px auto;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.rv-row:last-child { border-bottom: none; }
.rv-row-head {
  background: #fafbfc;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
  padding: 10px 16px;
}
.rv-row-item {
  cursor: pointer;
  transition: background 0.12s;
}
.rv-row-item:hover { background: rgba(235, 102, 34, 0.04); }
.rv-col-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.rv-row-name-text {
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rv-col-size, .rv-col-date {
  font-size: 0.86rem;
  color: #4b5563;
  white-space: nowrap;
}
.rv-col-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  align-items: center;
}

@media (max-width: 720px) {
  .rv-row { grid-template-columns: 1fr auto; gap: 8px; }
  .rv-col-size, .rv-col-date, .rv-row-head { display: none; }
}
</style>
