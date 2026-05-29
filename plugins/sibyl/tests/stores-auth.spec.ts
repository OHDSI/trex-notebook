import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/auth/trexAuth', async () => {
  const actual = await vi.importActual<typeof import('@/services/auth/trexAuth')>('@/services/auth/trexAuth')
  return {
    ...actual,
    login: vi.fn(),
    fetchUser: vi.fn(),
    logout: vi.fn(),
  }
})

import * as trexAuth from '@/services/auth/trexAuth'
import { useAuthStore } from '@/stores/auth'

const future = Math.floor(Date.now() / 1000) + 3600

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(() => vi.restoreAllMocks())

  it('starts unauthenticated with no stored session', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store.authContext.isAuthenticated).toBe(false)
  })

  it('login stores the session, fetches the user, and becomes authenticated', async () => {
    ;(trexAuth.login as ReturnType<typeof vi.fn>).mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_at: future })
    ;(trexAuth.fetchUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', email: 'dev@trex.local', app_metadata: { trex_role: 'admin' }, user_metadata: { name: 'Dev' } })
    const store = useAuthStore()
    await store.login('dev@trex.local', 'pw')
    expect(store.isAuthenticated).toBe(true)
    expect(store.authContext.user?.username).toBe('Dev')
    expect(JSON.parse(localStorage.getItem('sibyl.auth.session')!).access_token).toBe('a')
  })

  it('logout clears the session and de-authenticates', async () => {
    ;(trexAuth.login as ReturnType<typeof vi.fn>).mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_at: future })
    ;(trexAuth.fetchUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', email: 'dev@trex.local', app_metadata: { trex_role: 'admin' }, user_metadata: {} })
    const store = useAuthStore()
    await store.login('dev@trex.local', 'pw')
    store.logout()
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem('sibyl.auth.session')).toBeNull()
  })

  it('hydrate fetches the user when a non-expired session is stored', async () => {
    localStorage.setItem('sibyl.auth.session', JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: future }))
    ;(trexAuth.fetchUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', email: 'dev@trex.local', app_metadata: { trex_role: 'user' }, user_metadata: {} })
    const store = useAuthStore()
    await store.hydrate()
    expect(store.isAuthenticated).toBe(true)
    expect(store.authContext.user?.id).toBe('u1')
  })
})
