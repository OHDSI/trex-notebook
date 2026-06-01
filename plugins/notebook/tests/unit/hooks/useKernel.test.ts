/**
 * Unit tests for useKernel composable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withSetup } from '../../helpers/withSetup'
import { useKernel } from '@/hooks/useKernel'
import type { KernelPlugin, KernelConfig, KernelStatus, KernelOutput } from '@/kernels/types'

// Mock kernel implementation
function createMockKernel(id: string = 'pyodide'): KernelPlugin {
  let status: KernelStatus = 'disconnected'
  const statusCallbacks = new Set<(status: KernelStatus) => void>()

  return {
    id,
    name: 'Mock Kernel',
    languages: ['python'] as const,
    get status() {
      return status
    },
    async connect(/* config: KernelConfig */) {
      status = 'connecting'
      statusCallbacks.forEach((cb) => cb(status))
      await new Promise((resolve) => setTimeout(resolve, 10))
      status = 'idle'
      statusCallbacks.forEach((cb) => cb(status))
    },
    async disconnect() {
      status = 'disconnected'
      statusCallbacks.forEach((cb) => cb(status))
    },
    async *execute(/* code: string, language: 'python' | 'r' */): AsyncIterable<KernelOutput> {
      status = 'busy'
      statusCallbacks.forEach((cb) => cb(status))
      yield { type: 'stream', name: 'stdout', text: 'Hello' }
      status = 'idle'
      statusCallbacks.forEach((cb) => cb(status))
    },
    async interrupt() {
      status = 'idle'
      statusCallbacks.forEach((cb) => cb(status))
    },
    onStatusChange(callback: (status: KernelStatus) => void) {
      statusCallbacks.add(callback)
      return () => statusCallbacks.delete(callback)
    },
  }
}

describe('useKernel', () => {
  let mockKernel: KernelPlugin

  beforeEach(() => {
    mockKernel = createMockKernel()
  })

  it('starts with disconnected status', () => {
    const [api] = withSetup(() => useKernel())
    expect(api.status.value).toBe('disconnected')
    expect(api.kernel.value).toBeNull()
  })

  it('connects to a kernel', async () => {
    const [api] = withSetup(() => useKernel({ kernels: [mockKernel] }))

    await api.connect({ type: 'pyodide' } as KernelConfig)

    // shallowRef stores the raw object, so identity is preserved directly.
    expect(api.kernel.value).toBe(mockKernel)
    expect(api.status.value).toBe('idle')
  })

  it('disconnects from kernel', async () => {
    const [api] = withSetup(() => useKernel({ kernels: [mockKernel] }))

    await api.connect({ type: 'pyodide' } as KernelConfig)
    await api.disconnect()

    expect(api.status.value).toBe('disconnected')
  })

  it('throws when connecting to unknown kernel type', async () => {
    const [api] = withSetup(() => useKernel({ kernels: [mockKernel] }))

    await expect(api.connect({ type: 'unknown' } as KernelConfig)).rejects.toThrow(
      'No kernel found for type: unknown'
    )
  })

  it('calls onStatusChange callback', async () => {
    const onStatusChange = vi.fn()
    const [api] = withSetup(() => useKernel({ kernels: [mockKernel], onStatusChange }))

    await api.connect({ type: 'pyodide' } as KernelConfig)

    expect(onStatusChange).toHaveBeenCalled()
  })

  it('can execute code', async () => {
    const [api] = withSetup(() => useKernel({ kernels: [mockKernel] }))

    await api.connect({ type: 'pyodide' } as KernelConfig)

    const outputs: KernelOutput[] = []
    for await (const output of api.execute('print("hello")', 'python')) {
      outputs.push(output)
    }

    expect(outputs.length).toBeGreaterThan(0)
    expect(outputs[0].type).toBe('stream')
  })

  it('throws when executing without connection', () => {
    const [api] = withSetup(() => useKernel())

    expect(() => {
      api.execute('code', 'python')
    }).toThrow('No kernel connected')
  })
})
