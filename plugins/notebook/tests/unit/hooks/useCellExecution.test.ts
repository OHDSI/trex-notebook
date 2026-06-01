import { describe, it, expect } from 'vitest'
import { withSetup } from '../../helpers/withSetup'
import { useCellExecution } from '@/hooks/useCellExecution'
import type { KernelPlugin, KernelStatus, KernelOutput } from '@/kernels/types'

function streamKernel(text: string): KernelPlugin {
  return {
    id: 'pyodide',
    name: 'Pyodide',
    languages: ['python'],
    status: 'idle' as KernelStatus,
    async connect() {},
    async disconnect() {},
    async *execute(): AsyncIterable<KernelOutput> {
      yield { type: 'stream', name: 'stdout', text }
    },
    async interrupt() {},
    onStatusChange() {
      return () => {}
    },
  }
}

describe('useCellExecution', () => {
  it('appends stream output and sets success state', async () => {
    const appended: KernelOutput[] = []
    const states: string[] = []
    const [api] = withSetup(() =>
      useCellExecution({
        kernel: streamKernel('hello\n'),
        onCellOutputAppend: (_id, o) => appended.push(o as KernelOutput),
        onCellExecutionStateChange: (_id, s) => states.push(s),
      })
    )
    await api.executeCell('cell-1', 'print("hello")', 'python')
    expect(appended.some((o) => o.type === 'stream')).toBe(true)
    expect(states).toContain('running')
    expect(states).toContain('success')
  })

  it('throws NoKernelError when no kernel', async () => {
    const [api] = withSetup(() => useCellExecution({ kernel: null }))
    await expect(api.executeCell('c', 'x', 'python')).rejects.toThrow()
  })

  it('interrupts the live kernel from getKernel even when static kernel was null', async () => {
    let interrupted = false
    const live: KernelPlugin = {
      id: 'pyodide',
      name: 'Pyodide',
      languages: ['python'],
      status: 'idle' as KernelStatus,
      async connect() {},
      async disconnect() {},
      async *execute(): AsyncIterable<KernelOutput> {},
      async interrupt() {
        interrupted = true
      },
      onStatusChange() {
        return () => {}
      },
    }
    const [api] = withSetup(() => useCellExecution({ kernel: null, getKernel: () => live }))
    await api.interruptExecution()
    expect(interrupted).toBe(true)
  })
})
