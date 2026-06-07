import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const listEnvs = vi.fn()
const deleteEnv = vi.fn()
const setupEnv = vi.fn()
vi.mock('@/api/hadesClient', () => ({
  HadesClient: vi.fn().mockImplementation(() => ({ listEnvs, deleteEnv, setupEnv })),
  defaultHadesBase: () => 'http://h/hades-api',
}))

import { useEnvsStore } from '@/stores/envs'

describe('envs store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listEnvs.mockReset(); deleteEnv.mockReset(); setupEnv.mockReset()
  })

  it('fetchEnvs populates envs', async () => {
    listEnvs.mockResolvedValue([{ envName: 'a', path: '/a' }])
    const store = useEnvsStore()
    await store.fetchEnvs()
    expect(store.envs).toEqual([{ envName: 'a', path: '/a' }])
    expect(store.error).toBeNull()
  })

  it('deleteEnv removes then refetches', async () => {
    listEnvs.mockResolvedValueOnce([{ envName: 'a', path: '/a' }, { envName: 'b', path: '/b' }])
    listEnvs.mockResolvedValueOnce([{ envName: 'b', path: '/b' }])
    deleteEnv.mockResolvedValue(undefined)
    const store = useEnvsStore()
    await store.fetchEnvs()
    await store.deleteEnv('a')
    expect(deleteEnv).toHaveBeenCalledWith('a')
    expect(store.envs).toEqual([{ envName: 'b', path: '/b' }])
  })

  it('captures errors as a string', async () => {
    listEnvs.mockRejectedValue(new Error('boom'))
    const store = useEnvsStore()
    await store.fetchEnvs()
    expect(store.error).toBe('boom')
  })
})
