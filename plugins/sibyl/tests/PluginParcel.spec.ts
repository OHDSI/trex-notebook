import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Lazy-wrapper factory pattern (matches PluginLoader.spec.ts) so the production
// module can use static top-level imports without hitting Vitest's mock-hoisting TDZ.
const mountRootParcel = vi.fn()
vi.mock('single-spa', () => ({ mountRootParcel: (...a: unknown[]) => mountRootParcel(...a) }))

const getPlugin = vi.fn()
vi.mock('@/plugins/core/PluginRegistry', () => ({
  pluginRegistry: { getPlugin: (...a: unknown[]) => getPlugin(...a) },
}))

import { mountPluginParcel } from '@/plugins/core/PluginParcel'

describe('mountPluginParcel', () => {
  beforeEach(() => { mountRootParcel.mockReset(); getPlugin.mockReset() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('imports the entry and mounts a parcel into the element', async () => {
    const lifecycles = { bootstrap: vi.fn(), mount: vi.fn(), unmount: vi.fn() }
    const systemImport = vi.fn().mockResolvedValue(lifecycles)
    vi.stubGlobal('System', { import: systemImport })
    getPlugin.mockReturnValue({
      registration: { id: 'jobs-plugin', name: 'Jobs', entryPoint: 'http://h/jobs/index.system.js' },
      authContext: { token: 't', user: { id: 'u', username: 'n' } },
      messageBus: {},
    })
    const parcel = { mountPromise: Promise.resolve(), unmount: vi.fn() }
    mountRootParcel.mockReturnValue(parcel)
    const el = document.createElement('div')

    const result = await mountPluginParcel('jobs-plugin', el)

    expect(systemImport).toHaveBeenCalledWith('http://h/jobs/index.system.js')
    expect(mountRootParcel).toHaveBeenCalledWith(lifecycles, expect.objectContaining({ domElement: el, appId: 'jobs-plugin' }))
    expect(result).toBe(parcel)
  })

  it('resolves a relative entryPoint against BASE_URL', async () => {
    const systemImport = vi.fn().mockResolvedValue({})
    vi.stubGlobal('System', { import: systemImport })
    getPlugin.mockReturnValue({
      registration: { id: 'jobs-plugin', name: 'Jobs', entryPoint: 'jobs-plugin/index.system.js' },
      authContext: { token: 't', user: { id: 'u', username: 'n' } },
      messageBus: {},
    })
    mountRootParcel.mockReturnValue({ mountPromise: Promise.resolve(), unmount: vi.fn() })

    await mountPluginParcel('jobs-plugin', document.createElement('div'))

    expect(systemImport).toHaveBeenCalledWith(expect.stringContaining('/plugins/jobs-plugin/index.system.js'))
  })

  it('throws when the plugin is not registered', async () => {
    getPlugin.mockReturnValue(undefined)
    await expect(mountPluginParcel('nope', document.createElement('div'))).rejects.toThrow(/not registered/)
  })
})
