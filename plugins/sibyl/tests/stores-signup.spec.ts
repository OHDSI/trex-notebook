import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const get = vi.fn()
const post = vi.fn()
vi.mock('@/api/networkClient', () => ({
  NetworkClient: vi.fn().mockImplementation(() => ({ get, post })),
  defaultNetworkBase: () => 'http://n/network-api',
}))

import { useSignupStore } from '@/stores/signup'

describe('signup store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    get.mockReset(); post.mockReset()
  })

  it('refreshState reads the registration status', async () => {
    get.mockResolvedValue({ status: 'active' })
    const s = useSignupStore()
    await s.refreshState()
    expect(get).toHaveBeenCalledWith('/signup/state')
    expect(s.status).toBe('active')
    expect(s.error).toBeNull()
  })

  it('signup posts name+contact and goes pending', async () => {
    post.mockResolvedValue({ status: 'pending' })
    const s = useSignupStore()
    await s.signup({ name: 'Site A', contact: 'a@b.c' })
    expect(post).toHaveBeenCalledWith('/signup', { name: 'Site A', contact: 'a@b.c' })
    expect(s.status).toBe('pending')
  })

  it('signup captures the error and rethrows', async () => {
    post.mockRejectedValueOnce(new Error('boom'))
    const s = useSignupStore()
    await expect(s.signup({ name: 'A', contact: 'a@b.c' })).rejects.toThrow('boom')
    expect(s.error).toBe('boom')
  })

  it('poll updates status from /signup/status', async () => {
    get.mockResolvedValue({ status: 'active' })
    const s = useSignupStore()
    await s.poll()
    expect(get).toHaveBeenCalledWith('/signup/status')
    expect(s.status).toBe('active')
  })
})
