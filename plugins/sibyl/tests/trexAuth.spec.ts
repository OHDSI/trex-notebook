import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  login,
  fetchUser,
  toAuthContext,
  isExpired,
  saveSession,
  loadSession,
  clearSession,
  type TrexSession,
  type TrexUser,
} from '@/services/auth/trexAuth'

function mockFetch(impl: (url: string, init?: RequestInit) => { ok: boolean; status: number; body: unknown }) {
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const r = impl(String(url), init)
    return { ok: r.ok, status: r.status, json: async () => r.body } as unknown as Response
  }) as unknown as typeof fetch
}

describe('trexAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })
  afterEach(() => vi.restoreAllMocks())

  it('login posts credentials to the password-grant endpoint and returns a session', async () => {
    let calledUrl = ''
    let calledBody = ''
    mockFetch((url, init) => {
      calledUrl = url
      calledBody = String(init?.body ?? '')
      return {
        ok: true,
        status: 200,
        body: { access_token: 'a', refresh_token: 'r', expires_at: 123, expires_in: 3600, token_type: 'bearer' },
      }
    })
    const session = await login('dev@trex.local', 'pw')
    expect(calledUrl).toContain('/trex/auth/v1/token?grant_type=password')
    expect(JSON.parse(calledBody)).toEqual({ email: 'dev@trex.local', password: 'pw' })
    expect(session).toEqual({ access_token: 'a', refresh_token: 'r', expires_at: 123 })
  })

  it('login throws with the server error description on failure', async () => {
    mockFetch(() => ({ ok: false, status: 400, body: { error: 'invalid_grant', error_description: 'Bad creds' } }))
    await expect(login('x@y.z', 'nope')).rejects.toThrow('Bad creds')
  })

  it('fetchUser sends the bearer token and returns the user', async () => {
    let authHeader = ''
    mockFetch((url, init) => {
      authHeader = String((init?.headers as Record<string, string>)?.Authorization ?? '')
      expect(url).toContain('/trex/auth/v1/user')
      return { ok: true, status: 200, body: { id: 'u1', email: 'dev@trex.local', app_metadata: { trex_role: 'admin' }, user_metadata: { name: 'Dev' } } }
    })
    const user = await fetchUser('tok')
    expect(authHeader).toBe('Bearer tok')
    expect(user.id).toBe('u1')
  })

  it('toAuthContext maps an admin user; hasPermission allows anything', () => {
    const session: TrexSession = { access_token: 'a', refresh_token: 'r', expires_at: 999 }
    const user: TrexUser = { id: 'u1', email: 'dev@trex.local', app_metadata: { trex_role: 'admin' }, user_metadata: { name: 'Dev' } }
    const ctx = toAuthContext(session, user)
    expect(ctx.user).toEqual({ id: 'u1', username: 'Dev', email: 'dev@trex.local', permissions: ['admin'] })
    expect(ctx.token).toBe('a')
    expect(ctx.isAuthenticated).toBe(true)
    expect(ctx.hasPermission('anything')).toBe(true)
  })

  it('toAuthContext maps a non-admin user; hasPermission is scoped', () => {
    const session: TrexSession = { access_token: 'a', refresh_token: 'r', expires_at: 999 }
    const user: TrexUser = { id: 'u2', email: 'u@t.local', app_metadata: { trex_role: 'user' }, user_metadata: {} }
    const ctx = toAuthContext(session, user)
    expect(ctx.user?.username).toBe('u@t.local')
    expect(ctx.user?.permissions).toEqual(['user'])
    expect(ctx.hasPermission('user')).toBe(true)
    expect(ctx.hasPermission('admin')).toBe(false)
  })

  it('toAuthContext with null session/user is unauthenticated', () => {
    const ctx = toAuthContext(null, null)
    expect(ctx.user).toBeNull()
    expect(ctx.token).toBeNull()
    expect(ctx.isAuthenticated).toBe(false)
  })

  it('isExpired honors the skew window', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isExpired({ access_token: 'a', refresh_token: 'r', expires_at: now + 10 })).toBe(true)
    expect(isExpired({ access_token: 'a', refresh_token: 'r', expires_at: now + 600 })).toBe(false)
  })

  it('saveSession/loadSession/clearSession round-trip via localStorage', () => {
    const s: TrexSession = { access_token: 'a', refresh_token: 'r', expires_at: 1 }
    saveSession(s)
    expect(loadSession()).toEqual(s)
    clearSession()
    expect(loadSession()).toBeNull()
  })
})
