import { AuthContext } from '@/models/PluginModels'

const TREX_BASE = (import.meta.env.VITE_TREX_BASE as string | undefined) || '/trex'
const AUTH_URL = `${TREX_BASE}/auth/v1`
const STORAGE_KEY = 'sibyl.auth.session'

export interface TrexSession {
  access_token: string
  refresh_token: string
  expires_at: number // unix seconds
}

export interface TrexUser {
  id: string
  email: string
  app_metadata?: { trex_role?: string }
  user_metadata?: { name?: string }
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
}

function toSession(t: TokenResponse): TrexSession {
  return { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at }
}

export async function login(email: string, password: string): Promise<TrexSession> {
  const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string }
    throw new Error(body.error_description || body.error || `Login failed (${res.status})`)
  }
  return toSession((await res.json()) as TokenResponse)
}

export async function refresh(refreshToken: string): Promise<TrexSession> {
  const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error(`Refresh failed (${res.status})`)
  return toSession((await res.json()) as TokenResponse)
}

export async function fetchUser(token: string): Promise<TrexUser> {
  const res = await fetch(`${AUTH_URL}/user`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Failed to fetch user (${res.status})`)
  return (await res.json()) as TrexUser
}

export async function logout(token: string): Promise<void> {
  await fetch(`${AUTH_URL}/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
}

export function isExpired(session: TrexSession, skewSeconds = 60): boolean {
  return session.expires_at < Math.floor(Date.now() / 1000) + skewSeconds
}

export function loadSession(): TrexSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TrexSession) : null
  } catch {
    return null
  }
}

export function saveSession(session: TrexSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function toAuthContext(session: TrexSession | null, user: TrexUser | null): AuthContext {
  const role = user?.app_metadata?.trex_role ?? 'user'
  const permissions = user ? [role] : []
  return {
    user: user
      ? {
          id: user.id,
          username: user.user_metadata?.name || user.email,
          email: user.email,
          permissions,
        }
      : null,
    token: session?.access_token ?? null,
    isAuthenticated: !!session && !!user,
    hasPermission: (permission: string) => role === 'admin' || permissions.includes(permission),
  }
}
