<script setup lang="ts">
import { ref } from 'vue'
import JSZip from 'jszip'
import { AtlasAlert, AtlasButton, AtlasCard, AtlasIcon, AtlasProgressCircular } from '@ohdsi/atlas-ui'

const emit = defineEmits<{ loaded: [files: Map<string, ArrayBuffer>] }>()

const dragging = ref(false)
const loading = ref(false)
const progress = ref('')
const error = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function onDragOver(e: DragEvent) { e.preventDefault(); dragging.value = true }
function onDragLeave() { dragging.value = false }

async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) await processFile(file)
}

async function onFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) await processFile(file)
}

async function processFile(file: File) {
  loading.value = true
  error.value = ''
  try {
    if (file.name.endsWith('.zip')) {
      await processZip(file)
    } else if (file.name.endsWith('.parquet') || file.name.endsWith('.csv')) {
      const buf = await file.arrayBuffer()
      const files = new Map<string, ArrayBuffer>()
      files.set(file.name, buf)
      emit('loaded', files)
    } else {
      error.value = 'Unsupported file type. Use a ZIP of parquet/CSV files.'
    }
  } catch (e) {
    error.value = `Failed to load: ${e instanceof Error ? e.message : e}`
  } finally {
    loading.value = false
  }
}

async function processZip(file: File) {
  progress.value = 'Extracting ZIP...'
  const zip = await JSZip.loadAsync(file)
  const files = new Map<string, ArrayBuffer>()
  const entries = Object.entries(zip.files).filter(
    ([name, entry]) => !entry.dir && (name.endsWith('.parquet') || name.endsWith('.csv'))
  )
  for (let i = 0; i < entries.length; i++) {
    const [name, entry] = entries[i]
    const basename = name.split('/').pop() || name
    progress.value = `Loading ${basename} (${i + 1}/${entries.length})`
    files.set(basename, await entry.async('arraybuffer'))
  }
  if (files.size === 0) { error.value = 'No parquet or CSV files found in the ZIP.'; return }
  emit('loaded', files)
}
</script>

<template>
  <div :style="{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)', padding: '32px' }">
    <AtlasCard
      :style="{ maxWidth: '520px', width: '100%' }"
      padding="md"
    >
      <h3 :style="{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 4px' }">
        <AtlasIcon
          icon="mdi-chart-box-outline"
          color="primary"
          size="32"
        />
        Analysis Results
      </h3>
      <p :style="{ margin: '0 0 16px', color: 'rgba(var(--v-theme-on-surface), 0.6)', fontSize: '0.875rem' }">View OHDSI Strategus analysis results</p>

      <div>
        <div
          role="button"
          tabindex="0"
          :style="{
            border: dragging ? '2px dashed rgb(var(--v-theme-primary))' : '2px dashed rgba(0,0,0,0.12)',
            borderRadius: '8px',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            background: dragging ? 'rgba(var(--v-theme-primary), 0.04)' : 'transparent',
          }"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <template v-if="loading">
            <AtlasProgressCircular
              indeterminate
              color="primary"
              :style="{ marginBottom: '12px' }"
            />
            <div class="text-body-2 text-medium-emphasis">
              {{ progress }}
            </div>
          </template>
          <template v-else>
            <AtlasIcon
              icon="mdi-cloud-upload-outline"
              size="36"
              color="primary"
              :style="{ marginBottom: '12px', opacity: 0.7 }"
            />
            <div class="text-body-1">
              Drop a Strategus result export here
            </div>
            <div class="text-body-2 text-medium-emphasis mb-4">
              ZIP file containing parquet or CSV result tables
            </div>
            <AtlasButton
              variant="primary"
              size="sm"
              @click.stop="triggerFilePicker"
            >
              Browse files
            </AtlasButton>
            <input
              id="result-file-input"
              ref="fileInputRef"
              type="file"
              accept=".zip,.parquet,.csv"
              style="display:none"
              @change="onFileSelect"
            >
          </template>
        </div>

        <AtlasAlert
          v-if="error"
          severity="danger"
          variant="tonal"
          class="mt-3"
        >
          {{ error }}
        </AtlasAlert>
      </div>
    </AtlasCard>
  </div>
</template>
