import { ref, type Ref } from 'vue'
import type { KernelPlugin, KernelOutput } from '@/kernels/types'
import { KernelInterruptError } from '@/kernels/types'
import type { CellId, CodeCellData, CellOutput } from '@/types/notebook'

export class NoKernelError extends Error {
  constructor() {
    super('No kernel connected. Please select a kernel to run code.')
    this.name = 'NoKernelError'
  }
}

export class ExecutionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Execution timed out after ${Math.round(timeoutMs / 1000)} seconds`)
    this.name = 'ExecutionTimeoutError'
  }
}

export interface UseCellExecutionOptions {
  kernel: KernelPlugin | null
  /** Live getter for the active kernel (preferred over the static `kernel` snapshot,
   *  which may be stale because the composable is created once). */
  getKernel?: () => KernelPlugin | null
  getKernelForLanguage?: (language: 'python' | 'r') => KernelPlugin | null
  executionTimeout?: number
  onCellExecutionStart?: (cellId: CellId) => void
  onCellExecutionEnd?: (cellId: CellId, success: boolean) => void
  onCellOutputAppend?: (cellId: CellId, output: CellOutput) => void
  onCellExecutionStateChange?: (cellId: CellId, state: CodeCellData['executionState']) => void
  onCellExecutionCountSet?: (cellId: CellId, count: number) => void
  onCellOutputsClear?: (cellId: CellId) => void
  onNoKernel?: (cellId: CellId) => void
}

export interface UseCellExecutionReturn {
  isExecuting: Ref<boolean>
  executingCellId: Ref<CellId | null>
  executionQueue: Ref<CellId[]>
  executeCell: (cellId: CellId, code: string, language: 'python' | 'r') => Promise<void>
  executeCells: (
    cells: Array<{ id: CellId; code: string; language: 'python' | 'r' }>
  ) => Promise<void>
  interruptExecution: () => Promise<void>
}

let globalExecutionCount = 0
const DEFAULT_EXECUTION_TIMEOUT = 60_000

export function useCellExecution(options: UseCellExecutionOptions): UseCellExecutionReturn {
  const {
    kernel,
    getKernel,
    getKernelForLanguage,
    executionTimeout = DEFAULT_EXECUTION_TIMEOUT,
    onCellExecutionStart,
    onCellExecutionEnd,
    onCellOutputAppend,
    onCellExecutionStateChange,
    onCellExecutionCountSet,
    onCellOutputsClear,
    onNoKernel,
  } = options

  const isExecuting = ref(false)
  const executingCellId = ref<CellId | null>(null)
  const executionQueue = ref<CellId[]>([])
  let interrupted = false

  function convertOutput(output: KernelOutput, execCount: number): CellOutput | null {
    switch (output.type) {
      case 'stream':
        return { type: 'stream', name: output.name, text: output.text }
      case 'execute_result':
        return {
          type: 'execute_result',
          executionCount: execCount,
          data: output.data,
          metadata: output.metadata,
        }
      case 'display_data':
        return { type: 'display_data', data: output.data, metadata: output.metadata }
      case 'error':
        return {
          type: 'error',
          ename: output.ename,
          evalue: output.evalue,
          traceback: output.traceback,
        }
      case 'status':
        return null
    }
  }

  async function executeCell(cellId: CellId, code: string, language: 'python' | 'r') {
    const targetKernel = getKernelForLanguage?.(language) ?? getKernel?.() ?? kernel
    if (!targetKernel) {
      onNoKernel?.(cellId)
      throw new NoKernelError()
    }
    if (targetKernel.status !== 'idle' && targetKernel.status !== 'busy') {
      throw new Error(`Kernel is not ready (status: ${targetKernel.status})`)
    }

    const executionCount = ++globalExecutionCount
    isExecuting.value = true
    executingCellId.value = cellId
    interrupted = false

    onCellOutputsClear?.(cellId)
    onCellExecutionStateChange?.(cellId, 'running')
    onCellExecutionStart?.(cellId)

    let success = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    try {
      const timeoutPromise =
        executionTimeout > 0
          ? new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                interrupted = true
                targetKernel.interrupt().catch(() => {})
                reject(new ExecutionTimeoutError(executionTimeout))
              }, executionTimeout)
            })
          : null

      const executePromise = (async () => {
        for await (const output of targetKernel.execute(code, language)) {
          if (interrupted) break
          const cellOutput = convertOutput(output, executionCount)
          if (cellOutput) {
            onCellOutputAppend?.(cellId, cellOutput)
            if (cellOutput.type === 'error') success = false
          }
        }
      })()

      if (timeoutPromise) {
        await Promise.race([executePromise, timeoutPromise])
      } else {
        await executePromise
      }

      onCellExecutionCountSet?.(cellId, executionCount)
      onCellExecutionStateChange?.(cellId, success ? 'success' : 'error')
    } catch (error) {
      success = false
      if (error instanceof KernelInterruptError) {
        onCellExecutionStateChange?.(cellId, 'idle')
      } else if (error instanceof ExecutionTimeoutError) {
        onCellOutputAppend?.(cellId, {
          type: 'error',
          ename: 'ExecutionTimeoutError',
          evalue: error.message,
          traceback: ['Execution was automatically cancelled due to timeout.'],
        })
        onCellExecutionStateChange?.(cellId, 'error')
      } else {
        onCellOutputAppend?.(cellId, {
          type: 'error',
          ename: error instanceof Error ? error.constructor.name : 'Error',
          evalue: error instanceof Error ? error.message : String(error),
          traceback: error instanceof Error && error.stack ? error.stack.split('\n') : [],
        })
        onCellExecutionStateChange?.(cellId, 'error')
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      isExecuting.value = false
      executingCellId.value = null
      onCellExecutionEnd?.(cellId, success)
    }
  }

  async function executeCells(
    cells: Array<{ id: CellId; code: string; language: 'python' | 'r' }>
  ) {
    executionQueue.value = cells.map((c) => c.id)
    for (const cell of cells) {
      if (interrupted) break
      executionQueue.value = executionQueue.value.filter((id) => id !== cell.id)
      await executeCell(cell.id, cell.code, cell.language)
    }
    executionQueue.value = []
  }

  async function interruptExecution() {
    interrupted = true
    executionQueue.value = []
    const activeKernel = getKernel?.() ?? kernel
    if (activeKernel) await activeKernel.interrupt()
    if (executingCellId.value) {
      onCellExecutionStateChange?.(executingCellId.value, 'idle')
    }
    isExecuting.value = false
    executingCellId.value = null
  }

  return { isExecuting, executingCellId, executionQueue, executeCell, executeCells, interruptExecution }
}
