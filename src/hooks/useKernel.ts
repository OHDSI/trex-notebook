import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { KernelPlugin, KernelConfig, KernelStatus, KernelOutput } from '@/kernels/types'
import type { KernelInfo } from '@/components/notebook/NotebookToolbar'

export interface UseKernelOptions {
  kernels?: KernelPlugin[]
  defaultConfig?: KernelConfig
  onStatusChange?: (status: KernelStatus) => void
}

export interface UseKernelReturn {
  kernel: KernelPlugin | null
  status: KernelStatus
  isConnecting: boolean
  availableKernels: KernelInfo[]
  activeKernelId: string | undefined
  connect: (config: KernelConfig) => Promise<void>
  disconnect: () => Promise<void>
  execute: (code: string, language: 'python' | 'r') => AsyncIterable<KernelOutput>
  interrupt: () => Promise<void>
  switchKernel: (kernelId: string) => Promise<void>
}

export function useKernel(options: UseKernelOptions = {}): UseKernelReturn {
  const { kernels = [], defaultConfig, onStatusChange } = options

  const [kernel, setKernel] = useState<KernelPlugin | null>(null)
  const [status, setStatus] = useState<KernelStatus>('disconnected')
  const [isConnecting, setIsConnecting] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const lastConfigRef = useRef<KernelConfig | null>(null)

  const availableKernels = useMemo<KernelInfo[]>(
    () =>
      kernels.map((k) => ({
        id: k.id,
        name: k.name,
        languages: k.languages,
      })),
    [kernels]
  )

  const activeKernelId = kernel?.id

  const findKernel = useCallback(
    (config: KernelConfig): KernelPlugin | undefined => {
      return kernels.find((k) => k.id === config.type)
    },
    [kernels]
  )

  const connect = useCallback(
    async (config: KernelConfig) => {
      if (kernel && kernel.status !== 'disconnected') {
        await kernel.disconnect()
        unsubscribeRef.current?.()
      }

      const newKernel = findKernel(config)
      if (!newKernel) {
        throw new Error(`No kernel found for type: ${config.type}`)
      }

      setKernel(newKernel)
      setIsConnecting(true)
      lastConfigRef.current = config

      unsubscribeRef.current = newKernel.onStatusChange((newStatus) => {
        setStatus(newStatus)
        onStatusChange?.(newStatus)
      })

      try {
        await newKernel.connect(config)
        setStatus(newKernel.status)
      } catch (error) {
        setStatus('error')
        throw error
      } finally {
        setIsConnecting(false)
      }
    },
    [kernel, findKernel, onStatusChange]
  )

  const disconnect = useCallback(async () => {
    if (kernel) {
      await kernel.disconnect()
      unsubscribeRef.current?.()
      setStatus('disconnected')
    }
  }, [kernel])

  const execute = useCallback(
    (code: string, language: 'python' | 'r'): AsyncIterable<KernelOutput> => {
      if (!kernel) {
        throw new Error('No kernel connected')
      }
      return kernel.execute(code, language)
    },
    [kernel]
  )

  const interrupt = useCallback(async () => {
    if (kernel) {
      await kernel.interrupt()
    }
  }, [kernel])

  const switchKernel = useCallback(
    async (kernelId: string) => {
      const targetKernel = kernels.find((k) => k.id === kernelId)
      if (!targetKernel) {
        throw new Error(`No kernel found with ID: ${kernelId}`)
      }

      const config: KernelConfig = { type: kernelId } as KernelConfig

      await connect(config)
    },
    [kernels, connect]
  )

  useEffect(() => {
    if (defaultConfig && kernels.length > 0 && !kernel) {
      connect(defaultConfig).catch(console.error)
    }
  }, [defaultConfig, kernels, kernel, connect])

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
      kernel?.disconnect()
    }
  }, [kernel])

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
  }
}
