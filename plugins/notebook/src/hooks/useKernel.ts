import { ref, shallowRef, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { KernelPlugin, KernelConfig, KernelStatus, KernelOutput } from '@/kernels/types'

/** Kernel descriptor surfaced to the toolbar/UI. Defined here (was previously in
 *  NotebookToolbar) so consumers import it from the composable. */
export interface KernelInfo {
  id: string
  name: string
  languages: ReadonlyArray<'python' | 'r'>
}

export interface UseKernelOptions {
  kernels?: KernelPlugin[]
  defaultConfig?: KernelConfig
  /** Configs for all kernels — each is auto-connected with its matching config */
  kernelConfigs?: KernelConfig[]
  onStatusChange?: (status: KernelStatus) => void
}

export interface UseKernelReturn {
  kernel: Ref<KernelPlugin | null>
  status: Ref<KernelStatus>
  isConnecting: Ref<boolean>
  availableKernels: ComputedRef<KernelInfo[]>
  activeKernelId: ComputedRef<string | undefined>
  connect: (config: KernelConfig) => Promise<void>
  disconnect: () => Promise<void>
  execute: (code: string, language: 'python' | 'r') => AsyncIterable<KernelOutput>
  interrupt: () => Promise<void>
  switchKernel: (kernelId: string) => Promise<void>
  getKernelForLanguage: (language: 'python' | 'r') => KernelPlugin | null
  aggregateStatus: ComputedRef<KernelStatus>
  kernelStatuses: Ref<Map<string, KernelStatus>>
}

/** A single kernel error does not block the whole notebook — only report
 *  'error' if every kernel has failed. */
function computeAggregateStatus(statuses: KernelStatus[]): KernelStatus {
  if (statuses.length === 0) return 'disconnected'
  if (statuses.some((s) => s === 'busy')) return 'busy'
  if (statuses.some((s) => s === 'idle')) return 'idle'
  if (statuses.some((s) => s === 'connecting')) return 'connecting'
  if (statuses.every((s) => s === 'error')) return 'error'
  return 'disconnected'
}

export function useKernel(options: UseKernelOptions = {}): UseKernelReturn {
  const { kernels = [], defaultConfig, kernelConfigs, onStatusChange } = options

  const kernel = shallowRef<KernelPlugin | null>(null)
  const status = ref<KernelStatus>('disconnected')
  const kernelStatuses = ref<Map<string, KernelStatus>>(new Map())
  const isConnecting = ref(false)

  let unsubscribe: (() => void) | null = null
  const unsubscribes = new Map<string, () => void>()
  let multiKernelInit = false
  let connecting = false

  const availableKernels = computed<KernelInfo[]>(() =>
    kernels.map((k) => ({ id: k.id, name: k.name, languages: k.languages }))
  )

  const activeKernelId = computed(() => kernel.value?.id)

  const aggregateStatus = computed<KernelStatus>(() => {
    if (kernelStatuses.value.size === 0) return status.value
    return computeAggregateStatus(Array.from(kernelStatuses.value.values()))
  })

  function findKernel(config: KernelConfig): KernelPlugin | undefined {
    return kernels.find((k) => k.id === config.type)
  }

  function getKernelForLanguage(language: 'python' | 'r'): KernelPlugin | null {
    const k = kernels.find(
      (k) => k.languages.includes(language) && (k.status === 'idle' || k.status === 'busy')
    )
    return k ?? null
  }

  async function connect(config: KernelConfig) {
    if (connecting) return
    connecting = true
    try {
      if (kernel.value && kernel.value.status !== 'disconnected') {
        await kernel.value.disconnect()
      }
      unsubscribe?.()
      const newKernel = findKernel(config)
      if (!newKernel) {
        throw new Error(`No kernel found for type: ${config.type}`)
      }
      kernel.value = newKernel
      isConnecting.value = true
      unsubscribe = newKernel.onStatusChange((newStatus) => {
        status.value = newStatus
        onStatusChange?.(newStatus)
      })
      await newKernel.connect(config)
      status.value = newKernel.status
    } catch (error) {
      status.value = 'error'
      throw error
    } finally {
      isConnecting.value = false
      connecting = false
    }
  }

  async function disconnect() {
    if (kernel.value) {
      await kernel.value.disconnect()
      unsubscribe?.()
      status.value = 'disconnected'
    }
  }

  function execute(code: string, language: 'python' | 'r'): AsyncIterable<KernelOutput> {
    if (!kernel.value) throw new Error('No kernel connected')
    return kernel.value.execute(code, language)
  }

  async function interrupt() {
    if (kernel.value) await kernel.value.interrupt()
  }

  async function switchKernel(kernelId: string) {
    const targetKernel = kernels.find((k) => k.id === kernelId)
    if (!targetKernel) throw new Error(`No kernel found with ID: ${kernelId}`)
    await connect({ type: kernelId } as KernelConfig)
  }

  async function connectAllConfigured() {
    if (!kernelConfigs || kernelConfigs.length === 0 || kernels.length === 0) return
    if (multiKernelInit) return
    multiKernelInit = true
    await Promise.all(
      kernelConfigs.map(async (config) => {
        const k = kernels.find((kk) => kk.id === config.type)
        if (!k || k.status !== 'disconnected') return
        const unsub = k.onStatusChange((newStatus) => {
          const next = new Map(kernelStatuses.value)
          next.set(k.id, newStatus)
          kernelStatuses.value = next
        })
        unsubscribes.set(k.id, unsub)
        try {
          await k.connect(config)
          const next = new Map(kernelStatuses.value)
          next.set(k.id, k.status)
          kernelStatuses.value = next
        } catch (e) {
          console.warn(`Failed to connect kernel ${k.id}:`, e)
          const next = new Map(kernelStatuses.value)
          next.set(k.id, 'error')
          kernelStatuses.value = next
        }
      })
    )
  }

  onMounted(() => {
    if (kernelConfigs && kernelConfigs.length > 0) {
      void connectAllConfigured()
      return
    }
    // Single-kernel auto-connect (backward compat)
    if (defaultConfig && kernels.length > 0 && !kernel.value && !connecting) {
      connect(defaultConfig).catch(console.error)
    }
  })

  onUnmounted(() => {
    unsubscribe?.()
    for (const unsub of unsubscribes.values()) unsub()
    kernel.value?.disconnect()
  })

  return {
    kernel,
    status,
    isConnecting,
    availableKernels,
    activeKernelId,
    connect,
    disconnect,
    execute,
    interrupt,
    switchKernel,
    getKernelForLanguage,
    aggregateStatus,
    kernelStatuses,
  }
}
