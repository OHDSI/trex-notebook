import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PluginConfigService } from '@/services/PluginConfigService'

function mockFetchOnce(status: number, body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 404 ? 'Not Found' : 'OK',
    json: async () => body,
  }) as unknown as typeof fetch
}

describe('PluginConfigService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a default empty manifest when plugins.json is 404', async () => {
    mockFetchOnce(404, {})
    const svc = new PluginConfigService()
    const manifest = await svc.loadConfig()
    expect(manifest.plugins).toEqual([])
    expect(manifest.settings?.pluginsPath).toBe('plugins')
  })

  it('loads and validates a manifest with one plugin', async () => {
    mockFetchOnce(200, {
      version: '1.0',
      plugins: [
        {
          id: 'demo-plugin',
          name: 'Demo',
          version: '0.1.0',
          entryPoint: 'demo-plugin/index.system.js',
          menuItems: [{ id: 'm', name: 'Demo', route: '/plugins/demo-plugin/' }],
        },
      ],
    })
    const svc = new PluginConfigService()
    const manifest = await svc.loadConfig()
    expect(manifest.plugins).toHaveLength(1)
    expect(manifest.plugins[0].id).toBe('demo-plugin')
  })

  it('falls back to default manifest when a menu route is invalid', async () => {
    mockFetchOnce(200, {
      version: '1.0',
      plugins: [
        {
          id: 'bad-plugin',
          name: 'Bad',
          version: '0.1.0',
          entryPoint: 'bad-plugin/index.system.js',
          menuItems: [{ id: 'm', name: 'Bad', route: '/wrong/route' }],
        },
      ],
    })
    const svc = new PluginConfigService()
    const manifest = await svc.loadConfig()
    // route validation error → service catches and falls back to empty manifest
    expect(manifest.plugins).toEqual([])
  })

  it('isCoreNavigationItemEnabled defaults to true with no settings', async () => {
    mockFetchOnce(404, {})
    const svc = new PluginConfigService()
    await svc.loadConfig()
    expect(svc.isCoreNavigationItemEnabled('anything')).toBe(true)
  })
})
