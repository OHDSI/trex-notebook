import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type {
  CellId,
  CellLanguage,
  CellType,
  CodeCellData,
  NotebookData,
} from '@/types/notebook'
import { createCodeCell, createMarkdownCell, createEmptyNotebook, isCodeCell } from '@/types/notebook'
import type { KernelConfig, KernelStatus } from '@/kernels/types'

const MAX_HISTORY = 30

export interface UseNotebookOptions {
  initialData?: NotebookData
  onChange?: (data: NotebookData) => void
}

export interface NotebookActions {
  addCell: (type: CellType, position?: number, language?: CellLanguage) => CellId
  deleteCell: (cellId: CellId) => void
  moveCell: (cellId: CellId, newPosition: number) => void
  updateCellSource: (cellId: CellId, source: string) => void
  selectCell: (cellId: CellId | null) => void
  runCell: (cellId: CellId) => Promise<void>
  runAllCells: () => Promise<void>
  interruptExecution: () => Promise<void>
  clearCellOutputs: (cellId: CellId) => void
  clearAllOutputs: () => void
  connectKernel: (config: KernelConfig) => Promise<void>
  disconnectKernel: () => Promise<void>
  undo: () => void
  redo: () => void
  setCellExecutionState: (cellId: CellId, state: CodeCellData['executionState']) => void
  appendCellOutput: (cellId: CellId, output: CodeCellData['outputs'][number]) => void
  setCellLanguage: (cellId: CellId, language: CellLanguage) => void
  setCellExecutionCount: (cellId: CellId, count: number | null) => void
  setNotebook: (notebook: NotebookData) => void
}

export interface UseNotebookReturn {
  notebook: Ref<NotebookData>
  selectedCellId: Ref<CellId | null>
  kernelStatus: Ref<KernelStatus>
  isExecuting: Ref<boolean>
  actions: NotebookActions
  history: ComputedRef<{ canUndo: boolean; canRedo: boolean }>
}

export function useNotebook(options: UseNotebookOptions = {}): UseNotebookReturn {
  const { initialData, onChange } = options

  const notebook = ref<NotebookData>(initialData ?? createEmptyNotebook())
  const selectedCellId = ref<CellId | null>(null)
  const kernelStatus = ref<KernelStatus>('disconnected')
  const isExecuting = ref(false)
  const past = ref<NotebookData[]>([])
  const future = ref<NotebookData[]>([])

  function updateNotebook(
    updater: (prev: NotebookData) => NotebookData,
    skipHistory = false
  ) {
    const prev = notebook.value
    const next = updater(prev)
    if (!skipHistory) {
      past.value = [...past.value.slice(-MAX_HISTORY + 1), prev]
      future.value = []
    }
    notebook.value = next
    onChange?.(next)
  }

  function addCell(type: CellType, position?: number, language: CellLanguage = 'python'): CellId {
    const newCell = type === 'code' ? createCodeCell(language) : createMarkdownCell()
    updateNotebook((prev) => {
      const cells = [...prev.cells]
      const insertIndex = position ?? cells.length
      cells.splice(insertIndex, 0, newCell)
      return { ...prev, cells }
    })
    selectedCellId.value = newCell.id
    return newCell.id
  }

  function deleteCell(cellId: CellId) {
    updateNotebook((prev) => {
      const index = prev.cells.findIndex((c) => c.id === cellId)
      if (index === -1) return prev
      const cells = prev.cells.filter((c) => c.id !== cellId)
      if (selectedCellId.value === cellId) {
        const nextIndex = Math.min(index, cells.length - 1)
        selectedCellId.value = cells[nextIndex]?.id ?? null
      }
      return { ...prev, cells }
    })
  }

  function moveCell(cellId: CellId, newPosition: number) {
    updateNotebook((prev) => {
      const index = prev.cells.findIndex((c) => c.id === cellId)
      if (index === -1) return prev
      const cells = [...prev.cells]
      const [cell] = cells.splice(index, 1)
      const targetIndex = Math.max(0, Math.min(newPosition, cells.length))
      cells.splice(targetIndex, 0, cell)
      return { ...prev, cells }
    })
  }

  function updateCellSource(cellId: CellId, source: string) {
    updateNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) => (cell.id === cellId ? { ...cell, source } : cell)),
    }))
  }

  function setCellLanguage(cellId: CellId, language: CellLanguage) {
    updateNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) =>
        cell.id === cellId && isCodeCell(cell) && cell.language !== language
          ? { ...cell, language, outputs: [], executionCount: null, executionState: 'idle' as const }
          : cell
      ),
    }))
  }

  function selectCell(cellId: CellId | null) {
    selectedCellId.value = cellId
  }

  function setCellExecutionState(cellId: CellId, state: CodeCellData['executionState']) {
    updateNotebook(
      (prev) => ({
        ...prev,
        cells: prev.cells.map((cell) =>
          cell.id === cellId && isCodeCell(cell) ? { ...cell, executionState: state } : cell
        ),
      }),
      true
    )
  }

  function appendCellOutput(cellId: CellId, output: CodeCellData['outputs'][number]) {
    updateNotebook(
      (prev) => ({
        ...prev,
        cells: prev.cells.map((cell) =>
          cell.id === cellId && isCodeCell(cell)
            ? { ...cell, outputs: [...cell.outputs, output] }
            : cell
        ),
      }),
      true
    )
  }

  function setCellExecutionCount(cellId: CellId, count: number | null) {
    updateNotebook(
      (prev) => ({
        ...prev,
        cells: prev.cells.map((cell) =>
          cell.id === cellId && isCodeCell(cell) ? { ...cell, executionCount: count } : cell
        ),
      }),
      true
    )
  }

  function clearCellOutputs(cellId: CellId) {
    updateNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) =>
        cell.id === cellId && isCodeCell(cell)
          ? { ...cell, outputs: [], executionCount: null, executionState: 'idle' }
          : cell
      ),
    }))
  }

  function clearAllOutputs() {
    updateNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) =>
        isCodeCell(cell)
          ? { ...cell, outputs: [], executionCount: null, executionState: 'idle' }
          : cell
      ),
    }))
  }

  // Stubs — real kernel wiring lives in Notebook.vue (matches React behavior)
  async function runCell() {
    console.warn('runCell not yet implemented - needs kernel integration')
  }
  async function runAllCells() {
    console.warn('runAllCells not yet implemented - needs kernel integration')
  }
  async function interruptExecution() {
    console.warn('interruptExecution not yet implemented - needs kernel integration')
  }
  async function connectKernel() {
    kernelStatus.value = 'connecting'
    console.warn('connectKernel not yet implemented')
  }
  async function disconnectKernel() {
    kernelStatus.value = 'disconnected'
    console.warn('disconnectKernel not yet implemented')
  }

  function undo() {
    if (past.value.length === 0) return
    const previous = past.value[past.value.length - 1]
    const current = notebook.value
    past.value = past.value.slice(0, -1)
    future.value = [current, ...future.value]
    notebook.value = previous
    onChange?.(previous)
  }

  function redo() {
    if (future.value.length === 0) return
    const next = future.value[0]
    const current = notebook.value
    future.value = future.value.slice(1)
    past.value = [...past.value, current]
    notebook.value = next
    onChange?.(next)
  }

  function setNotebook(newNotebook: NotebookData) {
    updateNotebook(() => newNotebook)
  }

  const actions: NotebookActions = {
    addCell,
    deleteCell,
    moveCell,
    updateCellSource,
    setCellLanguage,
    selectCell,
    runCell,
    runAllCells,
    interruptExecution,
    clearCellOutputs,
    clearAllOutputs,
    connectKernel,
    disconnectKernel,
    undo,
    redo,
    setCellExecutionState,
    appendCellOutput,
    setCellExecutionCount,
    setNotebook,
  }

  const history = computed(() => ({
    canUndo: past.value.length > 0,
    canRedo: future.value.length > 0,
  }))

  return { notebook, selectedCellId, kernelStatus, isExecuting, actions, history }
}
