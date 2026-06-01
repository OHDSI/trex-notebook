// Types
export type {
  CellId,
  CellLanguage,
  CellType,
  ExecutionState,
  MimeBundle,
  StreamCellOutput,
  DisplayDataCellOutput,
  ExecuteResultCellOutput,
  ErrorCellOutput,
  CellOutput as CellOutputData,
  BaseCellData,
  CodeCellData,
  MarkdownCellData,
  CellData,
  NotebookMetadata,
  NotebookData,
} from './types/notebook'

export {
  createCodeCell,
  createMarkdownCell,
  createEmptyNotebook,
  isCodeCell,
  isMarkdownCell,
} from './types/notebook'

// Kernel types
export type {
  KernelStatus,
  KernelConfig,
  PyodideKernelConfig,
  WebRKernelConfig,
  JupyterKernelConfig,
  KernelOutput,
  StreamOutput,
  DisplayDataOutput,
  ExecuteResultOutput,
  ErrorOutput,
  StatusOutput,
  KernelPlugin,
  KernelFactory,
  KernelRegistry,
} from './kernels/types'

export { KernelInterruptError, KernelConnectionError } from './kernels/types'
export { kernelRegistry } from './kernels/registry'

// Composables
export { useNotebook } from './hooks/useNotebook'
export type { UseNotebookOptions, UseNotebookReturn, NotebookActions } from './hooks/useNotebook'
export { useKernel } from './hooks/useKernel'
export type { UseKernelOptions, UseKernelReturn, KernelInfo } from './hooks/useKernel'
export {
  useCellExecution,
  NoKernelError,
  ExecutionTimeoutError,
} from './hooks/useCellExecution'
export type { UseCellExecutionOptions, UseCellExecutionReturn } from './hooks/useCellExecution'

// Components
export { default as Notebook } from './components/notebook/Notebook.vue'
export type { NotebookTheme } from './components/notebook/Notebook.vue'
export { default as Cell } from './components/notebook/Cell.vue'
export { default as CodeCell } from './components/notebook/CodeCell.vue'
export { default as MarkdownCell } from './components/notebook/MarkdownCell.vue'
export { default as CellOutput } from './components/notebook/CellOutput.vue'
export { default as NotebookToolbar } from './components/notebook/NotebookToolbar.vue'
export { default as KernelStatusIndicator } from './components/notebook/KernelStatusIndicator.vue'

// Kernels
export { PyodideKernel } from './kernels/pyodide/PyodideKernel'
export { WebRKernel } from './kernels/webr/WebRKernel'
export { JupyterKernel } from './kernels/jupyter/JupyterKernel'

// Serialization utilities
export { toIpynb, fromIpynb, parseIpynb, serializeIpynb } from './utils/serialization'
