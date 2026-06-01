<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  Notebook,
  PyodideKernel,
  createEmptyNotebook,
  parseIpynb,
  serializeIpynb,
  type NotebookData,
} from '../../src'
import Button from '../../src/components/ui/Button.vue'
import { Download, Upload, FileText } from 'lucide-vue-next'

const pyodideKernel = new PyodideKernel()

const notebookData = ref<NotebookData>(createEmptyNotebook())
const hasUnsavedChanges = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value) {
    event.preventDefault()
    event.returnValue = ''
    return ''
  }
}
onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload))

function handleChange(data: NotebookData) {
  notebookData.value = data
  hasUnsavedChanges.value = true
}

function handleDownload() {
  const content = serializeIpynb(notebookData.value)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${notebookData.value.metadata.title || 'notebook'}.ipynb`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  hasUnsavedChanges.value = false
}

function handleUploadClick() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string
      const imported = parseIpynb(content)
      const titleFromFile = file.name.replace(/\.ipynb$/, '')
      notebookData.value = {
        ...imported,
        metadata: { ...imported.metadata, title: titleFromFile },
      }
    } catch (error) {
      console.error('Failed to parse notebook:', error)
      alert('Failed to parse notebook file. Please check that it is a valid .ipynb file.')
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function handleNewNotebook() {
  if (hasUnsavedChanges.value) {
    const confirmed = window.confirm(
      'Are you sure you want to create a new notebook? All unsaved changes will be lost.'
    )
    if (!confirmed) return
  }
  notebookData.value = createEmptyNotebook()
  hasUnsavedChanges.value = false
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="container flex h-14 items-center gap-4 px-4">
        <h1 class="text-lg font-semibold">Notebook</h1>
        <div class="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" @click="handleNewNotebook">
            <FileText class="mr-2 h-4 w-4" />
            New
          </Button>
          <Button variant="outline" size="sm" @click="handleUploadClick">
            <Upload class="mr-2 h-4 w-4" />
            Open
          </Button>
          <Button variant="outline" size="sm" @click="handleDownload">
            <Download class="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </header>

    <input ref="fileInput" type="file" accept=".ipynb" class="hidden" @change="handleFileChange" />

    <main class="flex-1 container px-4 py-6">
      <Notebook
        :data="notebookData"
        :on-change="handleChange"
        :kernels="[pyodideKernel]"
        :default-kernel-config="{ type: 'pyodide' }"
        :show-toolbar="true"
        :show-line-numbers="true"
      />
    </main>

    <footer class="border-t py-4">
      <div class="container px-4 text-center text-sm text-muted-foreground">
        Notebook Component Demo
      </div>
    </footer>
  </div>
</template>
