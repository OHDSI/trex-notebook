import { describe, it, expect, vi, beforeEach } from 'vitest'

const mountRootParcel = vi.fn()
vi.mock('single-spa', () => ({ mountRootParcel }))

const getPlugin = vi.fn()
vi.mock('@/plugins/core/PluginRegistry', () => ({ pluginRegistry: { getPlugin } }))

import { mountPluginParcel } from '@/plugins/core/PluginParcel'

describe('mountPluginParcel', () => {
  beforeEach(() => { mountRootParcel.mockReset(); getPlugin.mockReset() })

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

  it('throws when the plugin is not registered', async () => {
    getPlugin.mockReturnValue(undefined)
    await expect(mountPluginParcel('nope', document.createElement('div'))).rejects.toThrow(/not registered/)
  })
})
