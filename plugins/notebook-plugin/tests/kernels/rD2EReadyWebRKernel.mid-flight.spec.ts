import { describe, it, expect, afterEach, vi } from 'vitest'
import { WebRKernel, type KernelOutput } from '@trex/notebook'
import { RD2EReadyWebRKernel } from '../../src/kernels/rD2EReadyWebRKernel'

async function collect(iter: AsyncIterable<KernelOutput>): Promise<KernelOutput[]> {
  const out: KernelOutput[] = []
  for await (const o of iter) out.push(o)
  return out
}

describe('RD2EReadyWebRKernel — execute() bootstrap race', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not run user code until the bootstrap has finished, even while a call is in flight during bootstrap', async () => {
    const order: string[] = []
    let executeCallCount = 0
    let releaseBootstrap: () => void
    const bootstrapGate = new Promise<void>((resolve) => {
      releaseBootstrap = resolve
    })

    vi.spyOn(WebRKernel.prototype, 'connect').mockResolvedValue(undefined)
    vi.spyOn(WebRKernel.prototype, 'execute').mockImplementation(function (
      this: WebRKernel
    ): AsyncIterable<KernelOutput> {
      executeCallCount += 1
      const isBootstrapCall = executeCallCount === 1

      async function* generator(): AsyncGenerator<KernelOutput> {
        if (isBootstrapCall) {
          order.push('bootstrap-start')
          await bootstrapGate
          order.push('bootstrap-end')
        } else {
          order.push('user-execute-start')
          yield { type: 'stream', name: 'stdout', text: 'user output' } as KernelOutput
        }
      }
      return generator()
    })

    const kernel = new RD2EReadyWebRKernel()

    // Simulate a caller that doesn't await connect() (or a fast first cell):
    // fire connect() without awaiting it.
    const connectPromise = kernel.connect({ type: 'webr' } as any)

    // Let connect() actually reach runBootstrap() and start it (its own
    // `await super.connect()` defers that by a tick) before racing a real
    // execute() call against the in-flight bootstrap.
    await new Promise((resolve) => setTimeout(resolve, 0))
    const executePromise = collect(kernel.execute('1 + 1', 'r'))

    // Let the bootstrap run for a bit before completing it, so a would-be
    // race has a real window to slip through in.
    await new Promise((resolve) => setTimeout(resolve, 10))
    releaseBootstrap!()

    await connectPromise
    const outputs = await executePromise

    expect(order).toEqual(['bootstrap-start', 'bootstrap-end', 'user-execute-start'])
    expect(outputs).toEqual([{ type: 'stream', name: 'stdout', text: 'user output' }])
  })

  it('runs execute() immediately once the bootstrap has already completed', async () => {
    vi.spyOn(WebRKernel.prototype, 'connect').mockResolvedValue(undefined)
    vi.spyOn(WebRKernel.prototype, 'execute').mockImplementation(function (
      this: WebRKernel
    ): AsyncIterable<KernelOutput> {
      async function* generator(): AsyncGenerator<KernelOutput> {
        yield { type: 'stream', name: 'stdout', text: 'ok' } as KernelOutput
      }
      return generator()
    })

    const kernel = new RD2EReadyWebRKernel()
    await kernel.connect({ type: 'webr' } as any)

    const outputs = await collect(kernel.execute('1 + 1', 'r'))

    expect(outputs).toEqual([{ type: 'stream', name: 'stdout', text: 'ok' }])
  })
})
