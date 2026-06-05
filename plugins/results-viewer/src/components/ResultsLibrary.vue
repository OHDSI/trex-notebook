<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import JSZip from 'jszip'
import { AtlasPageShell, AtlasAlert, AtlasButton, AtlasIcon, AtlasIconButton, AtlasProgressCircular } from '@ohdsi/atlas-ui'
import { gunzipBuffer } from '../webr/gunzip'
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
    // A submitted binary DuckDB results file (optionally gzip-compressed) is
    // passed straight through as a single `results.db` entry; ShinyFrame sends
    // it to the viewer's DuckDB via the binary channel. Otherwise treat as a
    // ZIP of CSV/parquet exports.
    if (meta.name.endsWith('.db.gz')) {
      const raw = await gunzipBuffer(arr)
      emit('loaded', new Map([['results.db', raw]]))
      return
    }
    if (meta.name.endsWith('.db')) {
      emit('loaded', new Map([['results.db', arr]]))
      return
    }
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
    class="rv-drop-zone"
    role="region"
    aria-label="Analysis results library, drop a ZIP to import"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <AtlasPageShell
      hero
      compact
      eyebrow="OHDSI · Strategus"
      title="Analysis Results"
      subtitle="Saved Strategus result exports. Open a result to view it in the HADES viewer; import to add a new ZIP; export to download any stored result."
    >
      <template #actions>
        <AtlasButton
          variant="primary"
          prepend-icon="mdi-upload"
          :disabled="loading"
          @click.stop="triggerImport"
        >
          Import Result
        </AtlasButton>
        <input
          ref="fileInputRef"
          type="file"
          accept=".zip,.db,.db.gz"
          aria-label="Import Strategus result ZIP or DuckDB (.db/.db.gz)"
          style="display:none"
          @change="onImport"
        >
      </template>

      <AtlasAlert
        v-if="error"
        severity="danger"
        variant="tonal"
        class="rv-alert"
        closable
        @close="error = ''"
      >
        {{ error }}
      </AtlasAlert>

      <!-- Body -->
      <section class="rv-body">
        <div
          v-if="loading"
          class="rv-loading"
        >
          <AtlasProgressCircular
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
          <AtlasIcon
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
          <AtlasButton
            class="mt-4"
            variant="primary"
            prepend-icon="mdi-upload"
            @click.stop="triggerImport"
          >
            Import Result
          </AtlasButton>
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
              <AtlasIcon
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
              <AtlasIconButton
                icon="mdi-download"
                ariaLabel="Export ZIP"
                size="sm"
                variant="text"
                tone="neutral"
                @click.stop="onExport(item)"
              />
              <AtlasIconButton
                icon="mdi-delete-outline"
                ariaLabel="Delete from library"
                size="sm"
                variant="text"
                tone="danger"
                @click.stop="onDelete(item)"
              />
              <AtlasButton
                size="sm"
                variant="primary"
                @click.stop="openMeta(item)"
              >
                Open
              </AtlasButton>
            </div>
          </div>
        </div>
      </section>
    </AtlasPageShell>
  </div>
</template>

<style scoped>
/* Drop zone wrapper — full area, no visual chrome of its own */
.rv-drop-zone {
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.rv-alert { margin-bottom: 16px; border-radius: 10px; }

/* Empty / loading states */
.rv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 16px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.rv-empty-title {
  font-size: 1.05rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
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
.rv-loading-text { font-size: 0.9rem; color: rgba(var(--v-theme-on-surface), 0.7); }

/* Table-style list */
.rv-table {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 10px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}
.rv-row {
  display: grid;
  grid-template-columns: 1fr 100px 200px auto;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.rv-row:last-child { border-bottom: none; }
.rv-row-head {
  background: rgb(var(--v-theme-surface-variant));
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(var(--v-theme-on-surface), 0.6);
  padding: 10px 16px;
}
.rv-row-item {
  cursor: pointer;
  transition: background 0.12s;
}
.rv-row-item:hover { background: rgba(var(--v-theme-primary), 0.04); }
.rv-col-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.rv-row-name-text {
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rv-col-size, .rv-col-date {
  font-size: 0.86rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
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
