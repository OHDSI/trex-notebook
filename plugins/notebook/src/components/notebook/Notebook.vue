<script lang="ts">
/** Theme overrides applied as CSS custom properties on the notebook wrapper */
export interface NotebookTheme {
  primary?: string
  primaryForeground?: string
  background?: string
  foreground?: string
  secondary?: string
  secondaryForeground?: string
  accent?: string
  accentForeground?: string
  border?: string
  input?: string
  ring?: string
  muted?: string
  mutedForeground?: string
  destructive?: string
  success?: string
  warning?: string
  card?: string
  cardForeground?: string
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import draggable from 'vuedraggable'
import { Plus, Code, FileText, NotebookPen } from 'lucide-vue-next'
import { useNotebook } from '@/hooks/useNotebook'
import { useKernel } from '@/hooks/useKernel'
import { useCellExecution } from '@/hooks/useCellExecution'
import { isCodeCell } from '@/types/notebook'
import NotebookToolbar from './NotebookToolbar.vue'
import SortableCell from './SortableCell.vue'
import Button from '@/components/ui/Button.vue'
import { cn } from '@/lib/utils'
import type { NotebookData, CellId, CellLanguage } from '@/types/notebook'
import type { KernelPlugin, KernelConfig, KernelStatus } from '@/kernels/types'

const props = withDefaults(
  defineProps<{
    initialData?: NotebookData
    data?: NotebookData
    onChange?: (data: NotebookData) => void
    kernels?: KernelPlugin[]
    defaultKernelConfig?: KernelConfig
    kernelConfigs?: KernelConfig[]
    onKernelStatusChange?: (status: KernelStatus) => void
    showToolbar?: boolean
    showLineNumbers?: boolean
    readOnly?: boolean
    class?: string
    theme?: NotebookTheme
    showKernelSelector?: boolean
    onCellSelect?: (cellId: CellId | null) => void
    onCellExecuteStart?: (cellId: CellId) => void
    onCellExecuteEnd?: (cellId: CellId, success: boolean) => void
    virtualizationThreshold?: number
  }>(),
  {
    showToolbar: true,
    showLineNumbers: true,
    readOnly: false,
    showKernelSelector: true,
    virtualizationThreshold: 50,
  }
)

const themeStyle = computed<Record<string, string> | undefined>(() => {
  if (!props.theme) return undefined
  const vars: Record<string, string> = {}
  const map: [keyof NotebookTheme, string][] = [
    ['primary', '--color-primary'],
    ['primaryForeground', '--color-primary-foreground'],
    ['background', '--color-background'],
    ['foreground', '--color-foreground'],
    ['secondary', '--color-secondary'],
    ['secondaryForeground', '--color-secondary-foreground'],
    ['accent', '--color-accent'],
    ['accentForeground', '--color-accent-foreground'],
    ['border', '--color-border'],
    ['input', '--color-input'],
    ['ring', '--color-ring'],
    ['muted', '--color-muted'],
    ['mutedForeground', '--color-muted-foreground'],
    ['destructive', '--color-destructive'],
    ['success', '--color-success'],
    ['warning', '--color-warning'],
    ['card', '--color-card'],
    ['cardForeground', '--color-card-foreground'],
  ]
  for (const [key, cssVar] of map) {
    const v = props.theme[key]
    if (v) vars[cssVar] = v
  }
  return vars
})

const { notebook, selectedCellId, actions, history } = useNotebook({
  initialData: props.data ?? props.initialData,
  onChange: props.onChange,
})

const {
  kernel,
  status: kernelStatus,
  aggregateStatus,
  availableKernels,
  activeKernelId,
  connect: connectKernel,
  disconnect: disconnectKernel,
  switchKernel,
  getKernelForLanguage,
  kernelStatuses,
} = useKernel({
  kernels: props.kernels,
  defaultConfig: props.defaultKernelConfig,
  kernelConfigs: props.kernelConfigs,
  onStatusChange: props.onKernelStatusChange,
})

const cellExecution = useCellExecution({
  kernel: kernel.value,
  getKernel: () => kernel.value,
  getKernelForLanguage,
  onCellExecutionStart: props.onCellExecuteStart,
  onCellExecutionEnd: props.onCellExecuteEnd,
  onCellOutputAppend: actions.appendCellOutput,
  onCellExecutionStateChange: actions.setCellExecutionState,
  onCellExecutionCountSet: actions.setCellExecutionCount,
  onCellOutputsClear: actions.clearCellOutputs,
})

const isExecuting = cellExecution.isExecuting
const effectiveStatus = computed<KernelStatus>(() =>
  props.kernelConfigs ? aggregateStatus.value : kernelStatus.value
)
const kernelReady = computed(
  () => effectiveStatus.value === 'idle' || effectiveStatus.value === 'busy'
)
const useVirtualization = computed(
  () => notebook.value.cells.length >= props.virtualizationThreshold
)

async function runCell(cellId: CellId) {
  const cell = notebook.value.cells.find((c) => c.id === cellId)
  if (!cell || !isCodeCell(cell)) return
  await cellExecution.executeCell(cellId, cell.source, cell.language)
}

async function runAllCells() {
  const codeCells = notebook.value.cells
    .filter(isCodeCell)
    .map((c) => ({ id: c.id, code: c.source, language: c.language }))
  await cellExecution.executeCells(codeCells)
}

const cellList = computed({
  get: () => notebook.value.cells,
  set: (next) => {
    actions.setNotebook({ ...notebook.value, cells: next })
  },
})

function handleSelectCell(cellId: CellId) {
  actions.selectCell(cellId)
  props.onCellSelect?.(cellId)
}

function handleMoveCell(cellId: CellId, direction: 'up' | 'down') {
  const index = notebook.value.cells.findIndex((c) => c.id === cellId)
  if (index === -1) return
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= notebook.value.cells.length) return
  actions.moveCell(cellId, newIndex)
}

function handleDuplicateCell(cellId: CellId) {
  const cell = notebook.value.cells.find((c) => c.id === cellId)
  if (!cell) return
  const index = notebook.value.cells.findIndex((c) => c.id === cellId)
  const newCellId = actions.addCell(
    cell.type,
    index + 1,
    cell.type === 'code' ? cell.language : undefined
  )
  actions.updateCellSource(newCellId, cell.source)
}

function handleAddCodeCell(language: CellLanguage = 'python') {
  actions.addCell('code', undefined, language)
}
function handleAddMarkdownCell() {
  actions.addCell('markdown')
}

function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    if (event.key === 'Enter' && event.shiftKey && selectedCellId.value) {
      event.preventDefault()
      runCell(selectedCellId.value)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      actions.selectCell(null)
      return
    }
    return
  }

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const ctrlKey = isMac ? event.metaKey : event.ctrlKey

  if (ctrlKey && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    actions.undo()
    return
  }
  if ((ctrlKey && event.key === 'z' && event.shiftKey) || (ctrlKey && event.key === 'y')) {
    event.preventDefault()
    actions.redo()
    return
  }
  if (event.key === 'Enter' && event.shiftKey && selectedCellId.value) {
    event.preventDefault()
    runCell(selectedCellId.value)
    return
  }
  if (event.key === 'ArrowUp' && selectedCellId.value) {
    event.preventDefault()
    const index = notebook.value.cells.findIndex((c) => c.id === selectedCellId.value)
    if (index > 0) actions.selectCell(notebook.value.cells[index - 1].id)
    return
  }
  if (event.key === 'ArrowDown' && selectedCellId.value) {
    event.preventDefault()
    const index = notebook.value.cells.findIndex((c) => c.id === selectedCellId.value)
    if (index < notebook.value.cells.length - 1) actions.selectCell(notebook.value.cells[index + 1].id)
    return
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedCellId.value) {
    event.preventDefault()
    actions.deleteCell(selectedCellId.value)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    actions.selectCell(null)
    return
  }
  if (event.key === 'a' && selectedCellId.value) {
    event.preventDefault()
    const index = notebook.value.cells.findIndex((c) => c.id === selectedCellId.value)
    const selectedCell = notebook.value.cells[index]
    const lang: CellLanguage = selectedCell && isCodeCell(selectedCell) ? selectedCell.language : 'python'
    actions.addCell('code', index, lang)
    return
  }
  if (event.key === 'b' && selectedCellId.value) {
    event.preventDefault()
    const index = notebook.value.cells.findIndex((c) => c.id === selectedCellId.value)
    const selectedCell = notebook.value.cells[index]
    const lang: CellLanguage = selectedCell && isCodeCell(selectedCell) ? selectedCell.language : 'python'
    actions.addCell('code', index + 1, lang)
    return
  }
  if (event.key === 'm' && selectedCellId.value) {
    event.preventDefault()
    const cell = notebook.value.cells.find((c) => c.id === selectedCellId.value)
    if (cell && cell.type === 'code') {
      const index = notebook.value.cells.findIndex((c) => c.id === selectedCellId.value)
      actions.deleteCell(selectedCellId.value)
      const newId = actions.addCell('markdown', index)
      actions.updateCellSource(newId, cell.source)
    }
    return
  }
  if (event.key === 'y' && selectedCellId.value && !ctrlKey) {
    event.preventDefault()
    const cell = notebook.value.cells.find((c) => c.id === selectedCellId.value)
    if (cell && cell.type === 'markdown') {
      const index = notebook.value.cells.findIndex((c) => c.id === selectedCellId.value)
      actions.deleteCell(selectedCellId.value)
      const newId = actions.addCell('code', index, 'python')
      actions.updateCellSource(newId, cell.source)
    }
    return
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

defineExpose({
  getNotebookData: () => notebook.value,
  setNotebookData: (newData: NotebookData) => actions.setNotebook(newData),
  addCell: actions.addCell,
  deleteCell: actions.deleteCell,
  moveCell: actions.moveCell,
  focusCell: (cellId: CellId) => actions.selectCell(cellId),
  getCellData: (cellId: CellId) => notebook.value.cells.find((c) => c.id === cellId),
  updateCellSource: actions.updateCellSource,
  runCell,
  runAllCells,
  runCellsBelow: async (cellId: CellId) => {
    const index = notebook.value.cells.findIndex((c) => c.id === cellId)
    if (index === -1) return
    const codeCells = notebook.value.cells
      .slice(index)
      .filter(isCodeCell)
      .map((c) => ({ id: c.id, code: c.source, language: c.language }))
    await cellExecution.executeCells(codeCells)
  },
  interruptExecution: cellExecution.interruptExecution,
  clearCellOutputs: actions.clearCellOutputs,
  clearAllOutputs: actions.clearAllOutputs,
  connectKernel,
  disconnectKernel,
  getKernelStatus: () => effectiveStatus.value,
  undo: actions.undo,
  redo: actions.redo,
  canUndo: () => history.value.canUndo,
  canRedo: () => history.value.canRedo,
})
</script>

<template>
  <div :class="cn('flex flex-col gap-3', props.class)" :style="themeStyle">
    <NotebookToolbar
      v-if="showToolbar"
      :kernel-status="effectiveStatus"
      :is-executing="isExecuting"
      :can-undo="history.canUndo"
      :can-redo="history.canRedo"
      :available-kernels="availableKernels"
      :active-kernel-id="activeKernelId"
      :show-kernel-selector="showKernelSelector"
      :kernel-statuses="kernelStatuses"
      @kernel-change="switchKernel"
      @add-code-cell="handleAddCodeCell"
      @add-markdown-cell="handleAddMarkdownCell"
      @run-all-cells="runAllCells"
      @interrupt-execution="cellExecution.interruptExecution"
      @undo="actions.undo"
      @redo="actions.redo"
    />

    <div class="flex flex-col gap-2">
      <div
        v-if="notebook.cells.length === 0"
        class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-muted bg-muted/20 px-6 py-10 text-center"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <NotebookPen class="h-5 w-5" />
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-sm font-medium text-foreground">Start your notebook</p>
          <p class="text-sm text-muted-foreground">
            Add a cell to write and run analysis against this site’s data.
          </p>
        </div>
        <div class="mt-1 flex flex-wrap justify-center gap-2">
          <Button variant="outline" class="gap-2" @click="handleAddCodeCell('python')">
            <Code class="h-4 w-4" />
            Python
          </Button>
          <Button variant="outline" class="gap-2" @click="handleAddCodeCell('r')">
            <Code class="h-4 w-4" />
            R
          </Button>
          <Button variant="outline" class="gap-2" @click="handleAddMarkdownCell">
            <FileText class="h-4 w-4" />
            Markdown
          </Button>
        </div>
      </div>

      <template v-else>
        <draggable
          v-model="cellList"
          item-key="id"
          handle=".cell-drag-handle"
          :animation="150"
          class="flex flex-col gap-2"
        >
          <template #item="{ element: cell, index }">
            <SortableCell
              :cell="cell"
              :is-selected="selectedCellId === cell.id"
              :show-line-numbers="showLineNumbers"
              :read-only="readOnly"
              :kernel-ready="kernelReady"
              :use-virtualization="useVirtualization"
              :can-move-up="index > 0"
              :can-move-down="index < notebook.cells.length - 1"
              @select="handleSelectCell(cell.id)"
              @update-source="(source) => actions.updateCellSource(cell.id, source)"
              @run="runCell(cell.id)"
              @delete="actions.deleteCell(cell.id)"
              @move-up="handleMoveCell(cell.id, 'up')"
              @move-down="handleMoveCell(cell.id, 'down')"
              @duplicate="handleDuplicateCell(cell.id)"
              @change-language="(lang) => actions.setCellLanguage(cell.id, lang)"
            />
          </template>
        </draggable>

        <div v-if="!readOnly" class="flex justify-center gap-2 py-3">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            @click="handleAddCodeCell('python')"
          >
            <Plus class="h-4 w-4" />
            Python
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            @click="handleAddCodeCell('r')"
          >
            <Plus class="h-4 w-4" />
            R
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            @click="handleAddMarkdownCell"
          >
            <Plus class="h-4 w-4" />
            Markdown
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
