import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const request = vi.fn()
vi.mock('@/api/graphqlClient', () => ({
  GraphqlClient: vi.fn().mockImplementation(() => ({ request })),
  defaultGraphqlEndpoint: () => 'http://g/graphql',
}))

import { useSettingsStore, WEBAPI_SETTING_KEY } from '@/stores/settings'

describe('settings store', () => {
  beforeEach(() => { setActivePinia(createPinia()); request.mockReset() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('load reads the webapi_url setting', async () => {
    request.mockResolvedValue({ notebookAppSettingByKey: { value: 'https://w/WebAPI' } })
    const s = useSettingsStore()
    await s.load()
    expect(s.webApiUrl).toBe('https://w/WebAPI')
    expect(request.mock.calls[0][1]).toEqual({ k: WEBAPI_SETTING_KEY })
  })

  it('save updates when the setting already exists', async () => {
    request.mockResolvedValueOnce({ notebookAppSettingByKey: { value: 'old' } })
    request.mockResolvedValueOnce({ updateNotebookAppSettingByKey: { clientMutationId: null } })
    const s = useSettingsStore()
    await s.save('https://new/WebAPI')
    expect(s.webApiUrl).toBe('https://new/WebAPI')
    expect(request.mock.calls[1][0]).toContain('updateNotebookAppSettingByKey')
  })

  it('save creates when the setting does not exist', async () => {
    request.mockResolvedValueOnce({ notebookAppSettingByKey: null })
    request.mockResolvedValueOnce({ createNotebookAppSetting: { clientMutationId: null } })
    const s = useSettingsStore()
    await s.save('https://new/WebAPI')
    expect(request.mock.calls[1][0]).toContain('createNotebookAppSetting')
  })

  it('save captures the error and rethrows', async () => {
    request.mockRejectedValueOnce(new Error('nope'))
    const s = useSettingsStore()
    await expect(s.save('https://new/WebAPI')).rejects.toThrow('nope')
    expect(s.error).toBe('nope')
  })

  it('testConnection pings {url}/info', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const s = useSettingsStore()
    const ok = await s.testConnection('https://w/WebAPI/')
    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('https://w/WebAPI/info')
  })
})
