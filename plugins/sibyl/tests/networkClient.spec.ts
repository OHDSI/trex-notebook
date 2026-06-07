import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NetworkClient } from '@/api/networkClient'

describe('NetworkClient', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('get parses JSON and sends credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"status":"pending"}' })
    vi.stubGlobal('fetch', fetchMock)
    const c = new NetworkClient('http://n/network-api')
    const r = await c.get<{ status: string }>('/signup/state')
    expect(r).toEqual({ status: 'pending' })
    expect(fetchMock).toHaveBeenCalledWith('http://n/network-api/signup/state', expect.objectContaining({ method: 'GET', credentials: 'include' }))
  })

  it('post sends a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"status":"pending"}' })
    vi.stubGlobal('fetch', fetchMock)
    const c = new NetworkClient('http://n/network-api')
    await c.post('/signup', { name: 'Site A', contact: 'a@b.c' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ name: 'Site A', contact: 'a@b.c' })
  })

  it('throws the server error message on non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, statusText: 'Bad', text: async () => '{"error":{"code":"X","message":"nope"}}' }))
    const c = new NetworkClient('http://n/network-api')
    await expect(c.get('/signup/state')).rejects.toThrow('nope')
  })

  it('throws a clear error on a non-JSON (proxy/SPA) response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway', text: async () => '<html>oops</html>' }))
    const c = new NetworkClient('http://n/network-api')
    await expect(c.get('/signup/state')).rejects.toThrow(/non-JSON/)
  })
})
