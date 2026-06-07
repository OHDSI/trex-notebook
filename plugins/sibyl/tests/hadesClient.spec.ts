import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HadesClient } from '@/api/hadesClient'

describe('HadesClient', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('listEnvs returns the envs array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ envs: [{ envName: 'study1', path: '/d/study1' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const c = new HadesClient('http://h/hades-api')
    const envs = await c.listEnvs()
    expect(envs).toEqual([{ envName: 'study1', path: '/d/study1' }])
    expect(fetchMock).toHaveBeenCalledWith('http://h/hades-api/envs', expect.any(Object))
  })

  it('deleteEnv DELETEs the encoded name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const c = new HadesClient('http://h/hades-api')
    await c.deleteEnv('study 1')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://h/hades-api/envs/study%201',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('setupEnv POSTs envName + lockfilePath to /envs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })
    vi.stubGlobal('fetch', fetchMock)
    const c = new HadesClient('http://h/hades-api')
    await c.setupEnv('study2', '/locks/renv.lock')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://h/hades-api/envs')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ envName: 'study2', lockfilePath: '/locks/renv.lock' })
  })

  it('throws on non-ok responses (status in message)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    const c = new HadesClient('http://h/hades-api')
    await expect(c.listEnvs()).rejects.toThrow(/500/)
  })
})
