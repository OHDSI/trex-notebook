<template>
  <div ref="rootEl" class="notebook-editor studies-section-body">
    <button class="notebook-editor__back" @click="requestBack">
      <AtlasIcon icon="mdi-arrow-left" size="16" />
      <span>Studies</span>
    </button>

    <NotebookHeader
      :key="pickerKey"
      :notebooks="store.notebooks"
      :active-id="activeId"
      :can-save="!!activeId"
      :dirty="dirty"
      @select="openNotebook"
      @create="createOpen = true"
      @save="save"
      @rename="detailsOpen = true"
      @delete="deleteOpen = true"
      @import="triggerImport"
      @export="exportNotebook"
      @synced="reloadActive"
      @feedback="showFeedback"
    />

    <AtlasAlert v-if="store.error" severity="danger" class="mb-3">
      {{ store.error }}
    </AtlasAlert>

    <!-- Hidden file input drives Import, matching the React implementation. -->
    <input
      ref="fileInput"
      type="file"
      accept=".ipynb"
      class="notebook-editor__file"
      @change="onFileChange"
    />

    <div class="notebook-editor__body">
      <div v-if="!activeId" class="notebook-editor__empty">
        <NotebookEmptyState
          :has-notebooks="store.notebooks.length > 0"
          @create="createOpen = true"
          @import="triggerImport"
        />
      </div>

      <div v-show="activeId" class="notebook-editor__card">
        <Notebook
          ref="notebookRef"
          :initial-data="initialData"
          :kernels="kernels"
          :kernel-configs="kernelConfigs"
          :show-toolbar="true"
          :show-line-numbers="true"
          :show-kernel-selector="false"
          :theme="theme"
          :on-change="onChange"
        />
      </div>
    </div>

    <CreateNotebookDialog
      ref="createDialogRef"
      :open="createOpen"
      :existing-names="allNames"
      @cancel="createOpen = false"
      @confirm="confirmCreate"
    />

    <NotebookDetailsDialog
      :open="detailsOpen"
      :name="activeNotebook?.name ?? ''"
      :description="activeNotebook?.description ?? ''"
      :existing-names="otherNames"
      @cancel="detailsOpen = false"
      @confirm="confirmDetails"
    />

    <DeleteNotebookDialog
      :open="deleteOpen"
      :notebook-name="activeNotebook?.name ?? ''"
      @cancel="deleteOpen = false"
      @confirm="confirmDelete"
    />

    <DiscardChangesDialog
      :open="discardOpen"
      :message="discardMessage"
      @cancel="cancelDiscard"
      @confirm="confirmDiscard"
    />

    <AtlasSnackbar
      v-model="feedbackOpen"
      :timeout="3000"
      :severity="feedbackSeverity"
      :text="feedbackMessage"
      location="bottom"
    />
  </div>
</template>

<script setup lang="ts">
// The notebook working surface, ported from the React portal's NotebookManager:
// one header carrying every action, the notebook card, and modal dialogs.
//
// Entry point is unchanged — the Studies overview deep-links here with
// ?open=<rowId> or ?new=1 and NotebookApp.vue passes that through as `id`.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Notebook,
  PyodideKernel,
  createEmptyNotebook,
  serializeIpynb,
  parseIpynb,
} from '@trex/notebook'
import type { NotebookData } from '@trex/notebook'
import { AtlasAlert, AtlasIcon, AtlasSnackbar } from '@ohdsi/atlas-ui'
import NotebookHeader from '../components/NotebookHeader.vue'
import NotebookEmptyState from '../components/NotebookEmptyState.vue'
import CreateNotebookDialog from '../components/CreateNotebookDialog.vue'
import NotebookDetailsDialog from '../components/NotebookDetailsDialog.vue'
import DeleteNotebookDialog from '../components/DeleteNotebookDialog.vue'
import DiscardChangesDialog from '../components/DiscardChangesDialog.vue'
import { useAtlasNotebookTheme } from '../composables/useAtlasNotebookTheme'
import { useNotebooksStore } from '../store/useNotebooksStore'
import { RD2EReadyWebRKernel } from '../kernels/rD2EReadyWebRKernel'
import { pyodideIndexUrl } from '../kernels/pyodideAssets'
import { getWebApiToken } from '../api/authToken'
import type { NotebookDocument, NotebookTemplateDto } from '../api/types'

const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'saved', id: string): void }>()

const store = useNotebooksStore()

// Fresh kernels per component instance. useKernel skips connect() for any
// kernel whose status is not 'disconnected', so a module-level singleton would
// leave a remounted view with an empty kernelStatuses map and a stale
// 'disconnected' indicator. Same reasoning as the React NotebookManager.
const kernels = [new PyodideKernel(), new RD2EReadyWebRKernel()]

// rD2E reads these out of the R session (Sys.getenv) to reach d2e's own routes.
// TREX__DATASET_ID is deliberately empty: unlike the React notebook, this
// plugin has no dataset selector yet, so the rD2E calls that need a dataset
// (get_cohort_definition_set, run_strategus_flow) will report a missing dataset
// rather than silently querying the wrong one. `library(rD2E)` and the function
// definitions work regardless.
const kernelConfigs = [
  // indexUrl must match the bundled pyodide package or loadPyodide refuses to
  // start; see pyodideAssets.ts.
  { type: 'pyodide' as const, ...(pyodideIndexUrl ? { indexUrl: pyodideIndexUrl } : {}) },
  {
    type: 'webr' as const,
    envVars: {
      TREX__ENDPOINT_URL: window.location.origin,
      TREX__DATASET_ID: '',
      ...(getWebApiToken()
        ? { TREX__AUTHORIZATION_TOKEN: getWebApiToken() as string }
        : {}),
    },
  },
]

const rootEl = ref<HTMLElement | null>(null)
// Plain ref rather than useTemplateRef: this package declares vue ^3.4.0 and
// useTemplateRef only landed in 3.5, so a fresh install could break the build.
// In <script setup> a ref whose name matches the template's ref="" is bound
// automatically on every Vue 3.
const notebookRef = ref<{ setNotebookData: (d: NotebookData) => void } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
// Holds the dialog's own loaded template list (see its defineExpose) so
// confirmCreate can read the chosen template's content without a second
// network round trip.
const createDialogRef = ref<{ templates: NotebookTemplateDto[] } | null>(null)

const activeId = ref<string | null>(props.id)
const activeNotebook = ref<NotebookDocument | null>(null)
const initialData = ref<NotebookData>(createEmptyNotebook())
const current = ref<NotebookData>(initialData.value)
const theme = ref(useAtlasNotebookTheme(null))

const createOpen = ref(false)
const detailsOpen = ref(false)
const deleteOpen = ref(false)

// Unsaved-edit tracking, restored from the pre-rebuild editor (dropped by
// mistake during the rewrite). `applyContent`/`reportWrite` are the only
// places allowed to clear it — both mean the notebook on screen exactly
// matches a saved or freshly-loaded row.
const dirty = ref(false)

// Guards the three paths that can silently discard unsaved edits: switching
// notebooks via the header picker, leaving via the Studies back link, and
// reloading after a remote sync. `discardAction` tells
// confirmDiscard/cancelDiscard which of the three is pending; `pendingId`
// only matters for the 'switch' case.
const discardOpen = ref(false)
const discardAction = ref<'switch' | 'back' | 'reload' | null>(null)
const pendingId = ref<string | null>(null)

// A sync has already overwritten the row server-side by the time `synced`
// fires, so cancelling that path does not undo anything — it only declines
// to reload the editor's contents. That is a materially different claim than
// "switching/leaving will lose your edits", so the dialog's body text is
// parameterised per path rather than growing a second, near-identical dialog.
const discardMessage = computed(() =>
  discardAction.value === 'reload'
    ? 'This notebook was just synced from the remote repository. Reloading it now will replace your unsaved on-screen edits with the synced version — your edits are not saved anywhere else.'
    : 'This notebook has unsaved changes that will be lost.',
)

// Bumped whenever a notebook switch is cancelled. The header's <select> moves
// its own displayed value to the picked notebook as soon as the user picks it
// (that's how a native <select> — and Vuetify's VSelect — behave), but
// `activeId` never actually changed underneath it, so Vue's prop-diff finds
// nothing different and skips re-rendering NotebookHeader entirely; the
// dropdown would be left showing the wrong notebook. Changing `:key` forces a
// fresh NotebookHeader/picker instance that reads the current `activeId` from
// scratch, snapping the visible selection back to the notebook that is
// actually still loaded.
const pickerKey = ref(0)

const feedbackOpen = ref(false)
const feedbackSeverity = ref<'success' | 'danger' | 'warning'>('success')
const feedbackMessage = ref('')

const allNames = computed(() => store.notebooks.map((n) => n.name))
const otherNames = computed(() =>
  store.notebooks.filter((n) => n.rowId !== activeId.value).map((n) => n.name),
)

function showFeedback(type: 'success' | 'error' | 'warning', message: string): void {
  feedbackSeverity.value = type === 'error' ? 'danger' : type
  feedbackMessage.value = message
  feedbackOpen.value = true
}

// A successful row write with a failed git push is a warning, not a success:
// the notebook is saved, only the mirror is behind. Every write path (save,
// create, rename, delete, import) shares this check so none of them can
// silently report full success when the git mirror actually failed. Either
// way the row write itself succeeded, so the edits are no longer unsaved.
function reportWrite(successMessage: string): void {
  dirty.value = false
  if (store.mirrorWarning) showFeedback('warning', store.mirrorWarning)
  else showFeedback('success', successMessage)
}

function onChange(data: NotebookData): void {
  current.value = data
  dirty.value = true
}

// The notebook's content must be pushed through the exposed handle: the Vue
// useNotebook hook reads initialData once at setup and does not watch it, so a
// reactive :data binding would silently fail to switch notebooks.
function applyContent(data: NotebookData): void {
  initialData.value = data
  current.value = data
  dirty.value = false
  notebookRef.value?.setNotebookData(data)
}

async function loadNotebook(id: string): Promise<void> {
  try {
    const doc = await store.get(id)
    activeNotebook.value = doc
    activeId.value = doc.rowId
    applyContent(doc.content as NotebookData)
  } catch (e) {
    showFeedback('error', e instanceof Error ? e.message : String(e))
  }
}

async function openNotebook(id: string): Promise<void> {
  if (!id || id === activeId.value) return
  if (dirty.value) {
    pendingId.value = id
    discardAction.value = 'switch'
    discardOpen.value = true
    return
  }
  await loadNotebook(id)
}

function requestBack(): void {
  if (dirty.value) {
    discardAction.value = 'back'
    discardOpen.value = true
    return
  }
  emit('back')
}

async function confirmDiscard(): Promise<void> {
  discardOpen.value = false
  const action = discardAction.value
  discardAction.value = null
  if (action === 'back') {
    emit('back')
    return
  }
  if (action === 'switch') {
    const id = pendingId.value
    pendingId.value = null
    if (id) await loadNotebook(id)
    return
  }
  if (action === 'reload') {
    if (activeId.value) await loadNotebook(activeId.value)
  }
}

function cancelDiscard(): void {
  discardOpen.value = false
  const action = discardAction.value
  discardAction.value = null
  pendingId.value = null
  // Only the picker needs snapping back — the back button never touched the
  // select, so a cancelled 'back' has nothing visual left to undo.
  if (action === 'switch') pickerKey.value++
}

async function reloadActive(): Promise<void> {
  if (!activeId.value) return
  if (dirty.value) {
    discardAction.value = 'reload'
    discardOpen.value = true
    return
  }
  await loadNotebook(activeId.value)
}

async function save(): Promise<void> {
  const id = activeId.value
  const doc = activeNotebook.value
  if (!id || !doc) return
  try {
    await store.update(id, {
      name: doc.name,
      description: doc.description,
      content: current.value,
    })
    reportWrite('Notebook saved.')
    emit('saved', id)
  } catch (e) {
    showFeedback('error', `Failed to save notebook: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function confirmCreate(name: string, templateId: string | null): Promise<void> {
  createOpen.value = false
  const template = templateId
    ? createDialogRef.value?.templates.find((t) => t.id === templateId)
    : null
  try {
    const id = await store.create({
      name,
      description: template?.description ?? '',
      content: (template ? template.content : createEmptyNotebook()) as NotebookData,
    })
    await loadNotebook(id)
    reportWrite(`Notebook "${name}" created.`)
    emit('saved', id)
  } catch (e) {
    showFeedback('error', `Failed to create notebook: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function confirmDetails(payload: { name: string; description: string }): Promise<void> {
  detailsOpen.value = false
  const id = activeId.value
  if (!id) return
  try {
    await store.update(id, { ...payload, content: current.value })
    if (activeNotebook.value) {
      activeNotebook.value = { ...activeNotebook.value, ...payload }
    }
    reportWrite('Notebook updated.')
  } catch (e) {
    showFeedback('error', `Failed to update notebook: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function confirmDelete(): Promise<void> {
  deleteOpen.value = false
  const id = activeId.value
  const name = activeNotebook.value?.name ?? ''
  if (!id) return
  try {
    await store.remove(id)
    activeId.value = null
    activeNotebook.value = null
    applyContent(createEmptyNotebook())
    reportWrite(`Notebook "${name}" deleted.`)
  } catch (e) {
    showFeedback('error', `Failed to delete notebook: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function triggerImport(): void {
  fileInput.value?.click()
}

/** Append " 2", " 3", … until the name is free (case-insensitive). */
function uniqueName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((n) => n.toLowerCase()))
  if (!lower.has(base.toLowerCase())) return base
  let i = 1
  while (lower.has(`${base} ${i}`.toLowerCase())) i++
  return `${base} ${i}`
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    // parseIpynb validates as it parses; a non-notebook file throws here and is
    // reported rather than creating a broken row.
    const content = parseIpynb(text) as NotebookData
    const name = uniqueName(file.name.replace(/\.ipynb$/, ''), allNames.value)
    const id = await store.create({ name, description: '', content })
    await loadNotebook(id)
    reportWrite(`Notebook "${name}" imported.`)
  } catch (e) {
    showFeedback(
      'error',
      `Failed to import notebook. Check that it is a valid .ipynb file. (${e instanceof Error ? e.message : String(e)})`,
    )
  }
}

function exportNotebook(): void {
  const doc = activeNotebook.value
  if (!doc) return
  const blob = new Blob([serializeIpynb(current.value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${doc.name}.ipynb`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  theme.value = useAtlasNotebookTheme(rootEl.value)
  await store.fetch()
  if (props.id) {
    await loadNotebook(props.id)
  } else {
    // Reached via the Studies tab's ?new=1 deep link, which means "create a
    // notebook". Without this the user lands on the empty state with Save,
    // Delete, Export and Sync all inert, and no way to act on the intent.
    createOpen.value = true
  }
})

onUnmounted(() => {
  for (const kernel of kernels) {
    void kernel.disconnect?.().catch((e: unknown) => console.warn('Kernel cleanup failed:', e))
  }
})
</script>

<style scoped>
/* Padded, scrollable body inside the shared notebook shell card — matches the
   Studies section body so both plugins share the same rhythm. The page
   background sits behind the back link and header row, same as the React
   NotebookManager; the notebook itself lives in its own white card below. */
.studies-section-body {
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
  background: rgb(var(--v-theme-background));
}
.notebook-editor__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.notebook-editor__back:hover {
  text-decoration: underline;
}
/* White card the notebook (and the empty state) sit in beneath the header,
   matching React's `.notebook-manager__card`. Horizontal margin is left to
   the page's own 24px padding above rather than literally stacking React's
   32px on top of it, so the card's edges stay close to the header's — see
   task report for the full rationale. */
.notebook-editor__body {
  margin: 32px 0;
  padding: 32px;
  background: rgb(var(--v-theme-surface));
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.notebook-editor__empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.notebook-editor__card {
  overflow: auto;
}
.notebook-editor__file {
  display: none;
}
</style>
