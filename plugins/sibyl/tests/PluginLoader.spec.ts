import { describe, it, expect, beforeEach, vi } from 'vitest'

const registerApplication = vi.fn()
const start = vi.fn()
const triggerAppChange = vi.fn()
const getAppNames = vi.fn().mockReturnValue([])
const getAppStatus = vi.fn()

vi.mock('single-spa', () => ({
  registerApplication: (...a: unknown[]) => registerApplication(...a),
  start: (...a: unknown[]) => start(...a),
  triggerAppChange: (...a: unknown[]) => triggerAppChange(...a),
  getAppNames: (...a: unknown[]) => getAppNames(...a),
  getAppStatus: (...a: unknown[]) => getAppStatus(...a),
}))

import { PluginLoader } from '@/plugins/core/PluginLoader'
import { PluginRegistry } from '@/plugins/core/PluginRegistry'
import { createHostMessageBus } from '@/plugins/messaging/HostMessageBus'
import type { AuthContext, PluginRegistration } from '@/models/PluginModels'

const authStub: AuthContext = {
  user: { id: 'dev', username: 'dev', permissions: [] },
  token: null,
  isAuthenticated: true,
  hasPermission: () => true,
}

const registration: PluginRegistration = {
  id: 'demo-plugin',
  name: 'Demo',
  version: '0.1.0',
  entryPoint: 'demo-plugin/index.system.js',
  menuItems: [],
}

describe('PluginLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.System = {
      import: vi.fn().mockResolvedValue({
        bootstrap: vi.fn(),
        mount: vi.fn(),
        unmount: vi.fn(),
      }),
      register: vi.fn(),
      set: vi.fn(),
    } as unknown as Window['System']
  })

  it('imports the plugin from the resolved /plugins/ URL and registers it', async () => {
    const registry = new PluginRegistry()
    const instance = registry.registerPlugin(registration, authStub, createHostMessageBus('demo-plugin'))
    const loader = new PluginLoader(registry)

    await loader.loadPlugin(instance)

    expect(window.System.import).toHaveBeenCalledWith('/plugins/demo-plugin/index.system.js')
    expect(registerApplication).toHaveBeenCalledTimes(1)
    const arg = registerApplication.mock.calls[0][0] as { name: string; customProps: () => Record<string, unknown> }
    expect(arg.name).toBe('demo-plugin')
    const props = arg.customProps()
    expect(props.uiFilesUrl).toBe('/plugins/demo-plugin/')
    expect(props.authContext).toBe(authStub)
    expect(props.messageBus).toBeDefined()
    expect(registry.getPlugin('demo-plugin')?.state).toBe('loaded')
  })

  it('startPluginFramework calls single-spa start', () => {
    const registry = new PluginRegistry()
    const loader = new PluginLoader(registry)
    loader.startPluginFramework()
    expect(start).toHaveBeenCalledWith({ urlRerouteOnly: true })
  })
})
