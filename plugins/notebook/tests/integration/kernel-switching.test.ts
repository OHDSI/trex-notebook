/**
 * Integration tests for kernel switching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { withSetup } from '../helpers/withSetup'
import { useKernel } from '@/hooks/useKernel'
import type { KernelPlugin, KernelOutput, KernelStatus, KernelConfig } from '@/kernels/types'

// Create mock kernels for testing
function createMockKernel(id: string, name: string, languages: Array<'python' | 'r'>): KernelPlugin {
  let status: KernelStatus = 'disconnected'
  const statusCallbacks = new Set<(status: KernelStatus) => void>()

  return {
    id,
    name,
    languages: languages as ReadonlyArray<'python' | 'r'>,
    get status() {
      return status
    },
    async connect() {
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
    async *execute(): AsyncIterable<KernelOutput> {
      status = 'busy'
      statusCallbacks.forEach((cb) => cb(status))
      yield { type: 'stream', name: 'stdout', text: `Output from ${id}` }
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

describe('Kernel Switching Integration', () => {
  let pyodideKernel: KernelPlugin
  let webRKernel: KernelPlugin
  let jupyterKernel: KernelPlugin

  beforeEach(() => {
    pyodideKernel = createMockKernel('pyodide', 'Python (Pyodide)', ['python'])
    webRKernel = createMockKernel('webr', 'R (WebR)', ['r'])
    jupyterKernel = createMockKernel('jupyter', 'Jupyter', ['python', 'r'])
  })

  describe('useKernel hook', () => {
    it('starts with no kernel connected', () => {
      const [api] = withSetup(() => useKernel({ kernels: [pyodideKernel, webRKernel] }))

      expect(api.kernel.value).toBeNull()
      expect(api.status.value).toBe('disconnected')
    })

    it('connects to specified kernel', async () => {
      const [api] = withSetup(() => useKernel({ kernels: [pyodideKernel, webRKernel] }))

      await api.connect({ type: 'pyodide' } as KernelConfig)

      expect(api.kernel.value?.id).toBe('pyodide')
      expect(api.status.value).toBe('idle')
    })

    it('switches between kernels', async () => {
      const [api] = withSetup(() => useKernel({ kernels: [pyodideKernel, webRKernel] }))

      // Connect to pyodide
      await api.connect({ type: 'pyodide' } as KernelConfig)
      expect(api.kernel.value?.id).toBe('pyodide')

      // Switch to webr
      await api.connect({ type: 'webr' } as KernelConfig)
      expect(api.kernel.value?.id).toBe('webr')
    })

    it('disconnects previous kernel when switching', async () => {
      const [api] = withSetup(() => useKernel({ kernels: [pyodideKernel, webRKernel] }))

      // Connect to pyodide
      await api.connect({ type: 'pyodide' } as KernelConfig)

      // Switch to webr - pyodide should be disconnected
      await api.connect({ type: 'webr' } as KernelConfig)

      expect(pyodideKernel.status).toBe('disconnected')
      expect(webRKernel.status).toBe('idle')
    })

    it('lists available kernels', () => {
      const [api] = withSetup(() =>
        useKernel({ kernels: [pyodideKernel, webRKernel, jupyterKernel] })
      )

      expect(api.availableKernels.value).toHaveLength(3)
      expect(api.availableKernels.value.map((k) => k.id)).toEqual(['pyodide', 'webr', 'jupyter'])
    })

    it('tracks active kernel id', async () => {
      const [api] = withSetup(() => useKernel({ kernels: [pyodideKernel, webRKernel] }))

      expect(api.activeKernelId.value).toBeUndefined()

      await api.connect({ type: 'pyodide' } as KernelConfig)

      expect(api.activeKernelId.value).toBe('pyodide')
    })

    it('provides switchKernel convenience method', async () => {
      const [api] = withSetup(() => useKernel({ kernels: [pyodideKernel, webRKernel] }))

      await api.switchKernel('webr')

      expect(api.kernel.value?.id).toBe('webr')
    })

    it('throws error when switching to non-existent kernel', async () => {
      const [api] = withSetup(() => useKernel({ kernels: [pyodideKernel] }))

      await expect(api.switchKernel('nonexistent')).rejects.toThrow('No kernel found')
    })
  })

  describe('kernel execution after switch', () => {
    it('executes code with switched kernel', async () => {
      const [api] = withSetup(() => useKernel({ kernels: [pyodideKernel, webRKernel] }))

      // Connect to pyodide
      await api.connect({ type: 'pyodide' } as KernelConfig)

      // Execute with pyodide
      let outputs: KernelOutput[] = []
      for await (const output of api.execute('code', 'python')) {
        outputs.push(output)
      }
      expect(outputs[0]).toMatchObject({ text: 'Output from pyodide' })

      // Switch to webr
      await api.connect({ type: 'webr' } as KernelConfig)

      // Execute with webr
      outputs = []
      for await (const output of api.execute('code', 'r')) {
        outputs.push(output)
      }
      expect(outputs[0]).toMatchObject({ text: 'Output from webr' })
    })
  })

  describe('status updates during switch', () => {
    it('reports status changes through callback', async () => {
      const statusChanges: KernelStatus[] = []

      const [api] = withSetup(() =>
        useKernel({
          kernels: [pyodideKernel, webRKernel],
          onStatusChange: (status) => statusChanges.push(status),
        })
      )

      await api.connect({ type: 'pyodide' } as KernelConfig)

      expect(statusChanges).toContain('connecting')
      expect(statusChanges).toContain('idle')
    })
  })

  describe('auto-connect', () => {
    it('auto-connects with default config', async () => {
      const [api] = withSetup(() =>
        useKernel({
          kernels: [pyodideKernel],
          defaultConfig: { type: 'pyodide' } as KernelConfig,
        })
      )

      await vi.waitFor(() => {
        expect(api.status.value).toBe('idle')
      })

      expect(api.kernel.value?.id).toBe('pyodide')
    })
  })
})
