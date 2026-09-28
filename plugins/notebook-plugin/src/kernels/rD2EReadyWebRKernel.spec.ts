import { describe, it, expect, vi, beforeEach } from 'vitest'

// The real WebRKernel dynamically imports `webr`, which cannot start under
// happy-dom. Swap in a fake base class so the wrapper's own ordering logic is
// what gets tested.
const calls: string[] = []
let connectImpl: () => Promise<void> = async () => {}
let executeImpl: (code: string) => AsyncIterable<unknown> = async function* () {}

vi.mock('@trex/notebook', () => {
  class WebRKernel {
    async connect(): Promise<void> {
      calls.push('super.connect')
      await connectImpl()
    }
    async disconnect(): Promise<void> {
      calls.push('super.disconnect')
    }
    async interrupt(): Promise<void> {
      calls.push('super.interrupt')
    }
    // eslint-disable-next-line require-yield
    async *execute(code: string): AsyncIterable<unknown> {
      calls.push(code.includes('rD2E bootstrap') ? 'super.execute(bootstrap)' : 'super.execute(user)')
      yield* executeImpl(code) as AsyncIterable<unknown>
    }
  }
  return { WebRKernel }
})

const { RD2EReadyWebRKernel } = await import('./rD2EReadyWebRKernel')

const drain = async (it: AsyncIterable<unknown>) => {
  for await (const _ of it) { /* consume */ }
}

describe('RD2EReadyWebRKernel', () => {
  beforeEach(() => {
    calls.length = 0
    connectImpl = async () => {}
    executeImpl = async function* () {}
  })

  it('runs the bootstrap during connect, after the base kernel is up', async () => {
    const k = new RD2EReadyWebRKernel()
    await k.connect({ type: 'webr' } as never)
    expect(calls).toEqual(['super.connect', 'super.execute(bootstrap)'])
  })

  it('does not resolve connect() until the bootstrap has finished', async () => {
    // Deferred built up front: a generator body does not run until the first
    // next(), so assigning the resolver inside it would still be pending here.
    let released!: () => void
    const gate = new Promise<void>((r) => { released = r })
    executeImpl = async function* () {
      await gate
    }
    const k = new RD2EReadyWebRKernel()
    let done = false
    const p = k.connect({ type: 'webr' } as never).then(() => { done = true })
    await new Promise((r) => setTimeout(r, 0))
    expect(done).toBe(false)   // still bootstrapping
    released()
    await p
    expect(done).toBe(true)
  })

  it('makes user code wait for the bootstrap rather than racing it', async () => {
    const k = new RD2EReadyWebRKernel()
    await k.connect({ type: 'webr' } as never)
    await drain(k.execute('print(1)', 'r'))
    // The bootstrap must be fully executed before any user cell runs.
    expect(calls).toEqual([
      'super.connect',
      'super.execute(bootstrap)',
      'super.execute(user)',
    ])
  })

  it('rethrows a failed bootstrap so the kernel does not look ready', async () => {
    executeImpl = async function* () {
      throw new Error('webr died')
    }
    const k = new RD2EReadyWebRKernel()
    await expect(k.connect({ type: 'webr' } as never)).rejects.toThrow('webr died')
  })

  it('clears bootstrap state on disconnect', async () => {
    const k = new RD2EReadyWebRKernel()
    await k.connect({ type: 'webr' } as never)
    await k.disconnect()
    expect(calls).toContain('super.disconnect')
    // A fresh connect bootstraps again rather than reusing the dead session.
    calls.length = 0
    await k.connect({ type: 'webr' } as never)
    expect(calls).toEqual(['super.connect', 'super.execute(bootstrap)'])
  })
})
