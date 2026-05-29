# sibyl-as-trex-plugin + trex auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the sibyl shell as a trex UI plugin at `/plugins/sibyl` and authenticate it against trex's GoTrue-compatible API with sibyl's own login form, replacing the auth stub.

**Architecture:** One Vite codebase, dual base path (`/` standalone, `/plugins/sibyl/` when built for trex). A `trexAuth` service + Pinia `auth` store call trex's `/trex/auth/v1` endpoints and expose the existing `AuthContext`. A login view + router guard gate the app; the plugin framework initializes only once authenticated. trex runs from its published image with sibyl's `dist` mounted into `/usr/src/plugins-dev/sibyl`.

**Tech Stack:** Vue 3, Vite 5, Vuetify 3, Vue Router 4, Pinia, Vitest, Playwright. Backend: trex (`ghcr.io/ohdsi/trexsql:latest`), Better Auth (GoTrue-compatible).

**Reference:** design spec `docs/superpowers/specs/2026-05-29-sibyl-trex-plugin-auth-design.md`. Working dir `/home/ph/code/trex-sibyl`, branch `trex-sibyl-shell`. e2e runs with `PLAYWRIGHT_CHROMIUM_PATH=/home/ph/.cache/ms-playwright/chromium-1193/chrome-linux/chrome` (this OS can't `playwright install`).

---

## File Structure

```
trex-sibyl/
  package.json                       # MODIFY: add trex.ui.routes + build:trex script
  vite.config.ts                     # MODIFY: env base path + dev proxy for /trex
  src/
    services/auth/trexAuth.ts        # CREATE: trex GoTrue client + AuthContext mapping
    services/auth/authStub.ts        # DELETE (replaced)
    stores/auth.ts                   # CREATE: Pinia auth store
    views/LoginView.vue              # CREATE: email/password login form
    router/index.ts                  # MODIFY: /login route + global auth guard
    main.ts                          # MODIFY: hydrate auth, gate framework init on auth
  tests/
    trexAuth.spec.ts                 # CREATE: unit tests for the auth service
    stores-auth.spec.ts              # CREATE: unit tests for the store
    e2e/_auth.ts                     # CREATE: e2e auth mock helpers
    e2e/shell.spec.ts                # MODIFY: authenticate before asserting shell
    e2e/login.spec.ts                # CREATE: login-redirect + login-form flow
    e2e/plugin-mount.spec.ts         # MODIFY: authenticate before mount assertions
  deploy/trex-sibyl.override.yml     # CREATE: compose override mounting sibyl into trex
  README.md                          # MODIFY: trex integration + auth section
```

**trex facts used below (verified):** token endpoint `POST /trex/auth/v1/token?grant_type=password` body `{email,password}` → `{access_token, refresh_token, expires_at (unix s), expires_in, token_type}` (no user in body); `GET /trex/auth/v1/user` (Bearer) → `{id, email, app_metadata:{trex_role}, user_metadata:{name}}`; refresh `POST /trex/auth/v1/token?grant_type=refresh_token` body `{refresh_token}`; logout `POST /trex/auth/v1/logout` (Bearer). trex compose service is `trex`, HTTP on `:8000`, `PLUGINS_DEV_PATH=/usr/src/plugins-dev`.

---

## Task 1: Dual base path, dev proxy, trex plugin registration

**Files:**
- Modify: `vite.config.ts`, `package.json`

- [ ] **Step 1: Replace `vite.config.ts`** (env-driven base + `/trex` dev proxy)

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'

// Served at `/` standalone, or `/plugins/sibyl/` when built for trex
// (npm run build:trex). The router uses import.meta.env.BASE_URL, so the
// router base follows this automatically.
const uiBase = process.env.VITE_UI_BASE_PATH || '/'
// Where the dev server proxies trex backend calls (auth, rest, graphql).
const trexProxy = process.env.VITE_TREX_PROXY || 'http://localhost:8000'

export default defineConfig({
  base: uiBase,
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-vuetify': ['vuetify'],
          'vendor-utils': ['zod'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/trex': { target: trexProxy, changeOrigin: true, secure: false },
    },
  },
})
```

- [ ] **Step 2: Add `trex.ui.routes` and `build:trex` to `package.json`**

In the `"scripts"` block, add after the `build:fixture` line:
```json
    "build:trex": "vue-tsc && VITE_UI_BASE_PATH=/plugins/sibyl/ vite build",
```
And add a top-level `"trex"` key (e.g. directly after the `"scripts": { ... }` block):
```json
  "trex": {
    "ui": {
      "routes": [
        { "path": "/sibyl", "dir": "dist", "spa": true }
      ]
    }
  },
```

- [ ] **Step 3: Verify the standalone build still works and the trex build sets the base**

Run:
```bash
npm run build
npm run build:trex
grep -o '/plugins/sibyl/assets/[^"]*' dist/index.html | head -1
```
Expected: both builds succeed; the final grep prints an asset path beginning with `/plugins/sibyl/assets/` (confirms the base was applied).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts package.json
git commit -m "feat: env base path, /trex dev proxy, trex.ui plugin registration"
```

---

## Task 2: trexAuth service (TDD)

**Files:**
- Create: `tests/trexAuth.spec.ts`, `src/services/auth/trexAuth.ts`

- [ ] **Step 1: Write the failing test `tests/trexAuth.spec.ts`**

```ts
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
    expect(ctx.user?.username).toBe('u@t.local') // falls back to email when no name
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
    expect(isExpired({ access_token: 'a', refresh_token: 'r', expires_at: now + 10 })).toBe(true) // within 60s skew
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- trexAuth`
Expected: FAIL — cannot resolve `@/services/auth/trexAuth`.

- [ ] **Step 3: Create `src/services/auth/trexAuth.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- trexAuth`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/trexAuth.spec.ts src/services/auth/trexAuth.ts
git commit -m "feat: trexAuth GoTrue client + AuthContext mapping (TDD)"
```

---

## Task 3: Pinia auth store (TDD)

**Files:**
- Create: `tests/stores-auth.spec.ts`, `src/stores/auth.ts`

- [ ] **Step 1: Write the failing test `tests/stores-auth.spec.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- stores-auth`
Expected: FAIL — cannot resolve `@/stores/auth`.

- [ ] **Step 3: Create `src/stores/auth.ts`**

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthContext } from '@/models/PluginModels'
import * as trexAuth from '@/services/auth/trexAuth'
import type { TrexSession, TrexUser } from '@/services/auth/trexAuth'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<TrexSession | null>(trexAuth.loadSession())
  const user = ref<TrexUser | null>(null)

  const isAuthenticated = computed(() => !!session.value && !trexAuth.isExpired(session.value))

  const authContext = computed<AuthContext>(() => trexAuth.toAuthContext(session.value, user.value))

  async function login(email: string, password: string): Promise<void> {
    const s = await trexAuth.login(email, password)
    session.value = s
    trexAuth.saveSession(s)
    user.value = await trexAuth.fetchUser(s.access_token)
  }

  function logout(): void {
    if (session.value) void trexAuth.logout(session.value.access_token)
    session.value = null
    user.value = null
    trexAuth.clearSession()
  }

  // On boot: if a valid session is stored, load the user so authContext is
  // complete before the plugin framework initializes.
  async function hydrate(): Promise<void> {
    const s = session.value
    if (!s) return
    if (trexAuth.isExpired(s)) {
      logout()
      return
    }
    try {
      user.value = await trexAuth.fetchUser(s.access_token)
    } catch {
      logout()
    }
  }

  return { session, user, isAuthenticated, authContext, login, logout, hydrate }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- stores-auth`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/stores-auth.spec.ts src/stores/auth.ts
git commit -m "feat: Pinia auth store wrapping trexAuth (TDD)"
```

---

## Task 4: Login view + router guard

**Files:**
- Create: `src/views/LoginView.vue`
- Modify: `src/router/index.ts`

- [ ] **Step 1: Create `src/views/LoginView.vue`**

```vue
<template>
  <v-container class="fill-height" style="max-width: 480px">
    <v-row justify="center" align="center" style="width: 100%">
      <v-col cols="12">
        <v-card class="pa-6" data-test="login-card">
          <div class="d-flex align-center mb-4">
            <img :src="ohdsiLogo" alt="OHDSI" height="40" class="mr-2" >
            <span class="text-h6 font-weight-bold" style="letter-spacing: 0.08em">SIBYL</span>
          </div>
          <h1 class="text-subtitle-1 mb-4">Sign in</h1>
          <v-form @submit.prevent="onSubmit">
            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              autocomplete="username"
              data-test="login-email"
              :disabled="loading"
            />
            <v-text-field
              v-model="password"
              label="Password"
              type="password"
              autocomplete="current-password"
              data-test="login-password"
              :disabled="loading"
            />
            <v-alert
              v-if="error"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-4"
              data-test="login-error"
            >
              {{ error }}
            </v-alert>
            <v-btn type="submit" color="primary" block :loading="loading" data-test="login-submit">
              Sign in
            </v-btn>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ohdsiLogo from '@/assets/ohdsi-logo.png'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    const redirect = (route.query.redirect as string) || '/'
    await router.replace(redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sign in failed'
  } finally {
    loading.value = false
  }
}
</script>
```

- [ ] **Step 2: Replace `src/router/index.ts`** (add `/login` + global guard)

```ts
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import { generatePluginRoutes } from '@/plugins/navigation/PluginRoutes'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/', name: 'home', component: HomeView },
  ...generatePluginRoutes(),
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Global auth guard: unauthenticated users go to /login; authenticated users
// never see /login. Uses the Pinia auth store (Pinia is installed before the
// router in main.ts, so the store is available at navigation time).
router.beforeEach(to => {
  const auth = useAuthStore()
  if (!auth.isAuthenticated && to.name !== 'login') {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (auth.isAuthenticated && to.name === 'login') {
    return { path: (to.query.redirect as string) || '/' }
  }
  return true
})

export default router
```

- [ ] **Step 3: Verify types compile**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/views/LoginView.vue src/router/index.ts
git commit -m "feat: login view + global auth guard"
```

---

## Task 5: Bootstrap rewire (auth-gated framework init)

**Files:**
- Modify: `src/main.ts`
- Delete: `src/services/auth/authStub.ts`

- [ ] **Step 1: Replace `src/main.ts`**

```ts
import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { createVuetifyInstance } from './plugins/vuetify'
import { initializePluginFramework } from './plugins/index'
import { setupGlobalMessageHandler } from './plugins/messaging/HostMessageBus'
import { useAuthStore } from './stores/auth'
import { logger } from './utils/logger'

async function bootstrap() {
  const app = createApp(App)

  const vuetify = createVuetifyInstance()
  // Expose the host Vuetify singleton so plugins that externalize `vuetify`
  // resolve to it via SystemJS (see index.html).
  ;(window as unknown as { __atlasVuetify?: unknown }).__atlasVuetify = vuetify

  const pinia = createPinia()
  app.use(pinia)
  app.use(router)
  app.use(vuetify)

  setupGlobalMessageHandler(router)

  // Load + validate any stored session before mount so the first route guard
  // and the framework-init watcher see a complete auth state.
  const auth = useAuthStore(pinia)
  await auth.hydrate()

  app.mount('#app')

  // Initialize the plugin framework only once authenticated (on boot if a
  // valid session was hydrated, and again right after login). The framework
  // is idempotent, so the watcher firing more than once is safe.
  watch(
    () => auth.isAuthenticated,
    async authed => {
      if (!authed) return
      try {
        await initializePluginFramework(auth.authContext)
      } catch (error) {
        logger.error('main', 'Plugin framework initialization failed', error)
      }
    },
    { immediate: true }
  )
}

bootstrap().catch(error => {
  logger.error('main', 'Bootstrap failed', error)
})
```

- [ ] **Step 2: Delete the obsolete stub**

Run:
```bash
git rm src/services/auth/authStub.ts
```
(Nothing imports it anymore — `main.ts` now uses the auth store, and `tests/PluginLoader.spec.ts` defines its own inline auth object.)

- [ ] **Step 3: Verify types + unit tests + build**

Run: `npm run check-all`
Expected: type-check passes; unit tests pass (PluginConfigService 4 + PluginLoader 2 + trexAuth 8 + stores-auth 4 = 18); build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: gate plugin-framework init on authentication; drop authStub"
```

---

## Task 6: e2e for the auth flow

**Files:**
- Create: `tests/e2e/_auth.ts`, `tests/e2e/login.spec.ts`
- Modify: `tests/e2e/shell.spec.ts`, `tests/e2e/plugin-mount.spec.ts`

- [ ] **Step 1: Create `tests/e2e/_auth.ts`** (shared mocks)

```ts
import type { Page } from '@playwright/test'

export const MOCK_USER = {
  id: 'u1',
  email: 'dev@trex.local',
  app_metadata: { trex_role: 'admin' },
  user_metadata: { name: 'Dev' },
}

// Intercept trex's auth endpoints so tests run without a live trex backend.
export async function mockTrexAuth(page: Page): Promise<void> {
  await page.route('**/trex/auth/v1/user', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route('**/trex/auth/v1/token**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'fake-jwt',
        refresh_token: 'fake-refresh',
        // expires_at computed in the browser context (seconds, +1h)
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
      }),
    })
  )
}

// Seed a non-expired session so the guard treats the page as authenticated.
export async function seedSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sibyl.auth.session',
      JSON.stringify({ access_token: 'fake-jwt', refresh_token: 'fake-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 })
    )
  })
}
```

- [ ] **Step 2: Replace `tests/e2e/shell.spec.ts`** (authenticate first)

```ts
import { test, expect } from '@playwright/test'
import { mockTrexAuth, seedSession } from './_auth'

test('authenticated shell shows the empty no-plugins state', async ({ page }) => {
  await mockTrexAuth(page)
  await seedSession(page)
  await page.goto('/')
  await expect(page.getByTestId('brand')).toHaveText('SIBYL')
  await expect(page.getByTestId('no-plugins')).toBeVisible()
  await expect(page.getByTestId('nav-empty')).toBeVisible()
})
```

- [ ] **Step 3: Create `tests/e2e/login.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { mockTrexAuth } from './_auth'

test('unauthenticated visit redirects to the login form', async ({ page }) => {
  await mockTrexAuth(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByTestId('login-card')).toBeVisible()
})

test('signing in lands on the shell', async ({ page }) => {
  await mockTrexAuth(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await page.getByTestId('login-email').locator('input').fill('dev@trex.local')
  await page.getByTestId('login-password').locator('input').fill('pw')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('brand')).toHaveText('SIBYL')
  await expect(page.getByTestId('no-plugins')).toBeVisible()
})
```

- [ ] **Step 4: Replace `tests/e2e/plugin-mount.spec.ts`** (authenticate before mounting)

```ts
import { test, expect } from '@playwright/test'
import { mockTrexAuth, seedSession } from './_auth'

const fixtureManifest = {
  version: '1.0',
  plugins: [
    {
      id: 'hello-fixture-plugin',
      name: 'Hello Fixture',
      version: '1.0.0',
      entryPoint: 'hello-fixture-plugin/index.system.js',
      menuItems: [
        { id: 'main', name: 'Hello Fixture', route: '/plugins/hello-fixture-plugin/', icon: 'mdi-hand-wave-outline' },
      ],
    },
  ],
}

test('host loads and mounts a plugin from the manifest', async ({ page }) => {
  await mockTrexAuth(page)
  await seedSession(page)
  await page.route('**/config/plugins.json', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureManifest) })
  )

  await page.goto('/plugins/hello-fixture-plugin/')

  await expect(page.getByTestId('nav-hello-fixture-plugin')).toBeVisible()
  await expect(page.getByTestId('fixture-root')).toBeVisible()
  await expect(page.getByTestId('fixture-root')).toContainText('Hello Fixture Plugin')
})
```

- [ ] **Step 5: Run the full e2e suite**

Run:
```bash
PLAYWRIGHT_CHROMIUM_PATH=/home/ph/.cache/ms-playwright/chromium-1193/chrome-linux/chrome npm run test:e2e
```
Expected: PASS — 4 tests (shell empty-state, login-redirect, login-flow, plugin-mount).

- [ ] **Step 6: Commit**

```bash
git add tests/e2e
git commit -m "test: e2e for auth guard, login flow, and authenticated plugin mount"
```

---

## Task 7: Deploy override + README + final verification

**Files:**
- Create: `deploy/trex-sibyl.override.yml`
- Modify: `README.md`

- [ ] **Step 1: Create `deploy/trex-sibyl.override.yml`**

```yaml
# Compose override that serves the built sibyl shell as a trex UI plugin at
# /plugins/sibyl, using trex's published image. Layer it on trex's compose,
# running FROM the trex repo directory so the relative paths resolve:
#
#   cd ../trex
#   docker compose -f docker-compose.yml -f ../trex-sibyl/deploy/trex-sibyl.override.yml up
#
# Build sibyl first:  (in trex-sibyl)  npm run build:trex
services:
  trex:
    volumes:
      - ../trex-sibyl/package.json:/usr/src/plugins-dev/sibyl/package.json:ro
      - ../trex-sibyl/dist:/usr/src/plugins-dev/sibyl/dist:ro
```

- [ ] **Step 2: Update `README.md`** — append a "Run inside trex" section before the `## Follow-ups` section

```markdown
## Run inside trex (as a UI plugin)

sibyl can run as a trex UI plugin served at `/plugins/sibyl`, using trex as the
backend and identity provider.

1. Build sibyl for the trex route:

       npm run build:trex      # base = /plugins/sibyl/

2. From the trex repo, start trex (published image) with sibyl mounted in:

       cd ../trex
       docker compose -f docker-compose.yml -f ../trex-sibyl/deploy/trex-sibyl.override.yml up

3. Open `http://localhost:8000/plugins/sibyl` and sign in with a trex account.

### Auth

sibyl authenticates against trex's GoTrue-compatible API (`/trex/auth/v1`) with
its own login form, storing the session under `localStorage["sibyl.auth.session"]`.
The plugin framework initializes only once authenticated. For standalone dev
(`npm run dev`), the Vite server proxies `/trex` to `VITE_TREX_PROXY`
(default `http://localhost:8000`), so a locally-running trex can serve real logins.
```

- [ ] **Step 3: Final verification**

Run:
```bash
npm run check-all
PLAYWRIGHT_CHROMIUM_PATH=/home/ph/.cache/ms-playwright/chromium-1193/chrome-linux/chrome npm run test:e2e
npm run build:trex && grep -o '/plugins/sibyl/assets/[^"]*' dist/index.html | head -1
```
Expected: check-all passes (18 unit tests, type-check, build); e2e 4/4 pass; the trex build emits assets under `/plugins/sibyl/assets/`.

- [ ] **Step 4: Commit**

```bash
git add deploy/trex-sibyl.override.yml README.md
git commit -m "docs: trex override compose + run/auth README section"
```

---

## Self-Review Notes (for the implementer)

- **AuthContext token freshness:** plugins receive `authContext.token` at framework-init time (a snapshot). Token refresh after init does not propagate to already-loaded plugins. Acceptable for this iteration (no plugin calls the backend yet); a follow-up should make the loader read a live token getter. Do not add refresh-propagation now.
- **Guard + Pinia ordering:** the router guard calls `useAuthStore()` at navigation time; `main.ts` installs Pinia before `app.use(router)` and before mount (first navigation), so the active Pinia exists. Don't move the router install before Pinia.
- **`hydrate()` before mount:** `main.ts` awaits `auth.hydrate()` before `app.mount`, so the first guard evaluation and the `immediate` watcher see the resolved user. Keep that order.
- **Base path consistency:** `npm run build:trex` sets `VITE_UI_BASE_PATH=/plugins/sibyl/`; the router (`createWebHistory(import.meta.env.BASE_URL)`), SystemJS `%BASE_URL%` vendor scripts, and the micro-frontend loader all derive from it. Don't hardcode `/plugins/sibyl/` anywhere else.
- **e2e auth selectors:** Vuetify `v-text-field` renders an inner `<input>`; tests target `getByTestId('login-email').locator('input')`. Keep the `data-test` on the field and fill the inner input.
```
