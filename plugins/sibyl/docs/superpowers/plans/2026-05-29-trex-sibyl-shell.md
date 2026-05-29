# trex-sibyl ATLAS-plugin Host Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an empty-but-working Vue 3 host shell that loads ATLAS micro-frontend plugins at runtime via SystemJS + single-spa, implementing the same plugin contract as Atlas3, ready to host the Strategus plugin later.

**Architecture:** Port the *zero-domain-coupling* plugin-framework files from Atlas3 (`../Atlas3`) verbatim, adapt the two files that couple to Atlas3 domain code (`PluginLoader`, `vuetify`), and write a minimal Vuetify shell (app bar + nav from `plugins.json` + plugin route). Ships with an empty `plugins.json`; a test-only fixture plugin proves end-to-end loading.

**Tech Stack:** Vue 3.4, TypeScript (strict), Vite 5, Vuetify 3, Vue Router 4, Pinia, SystemJS + single-spa, Zod, Vitest, Playwright.

**Reference repo:** `/home/ph/code/Atlas3` (referred to below as `$A`). Many steps copy files verbatim from there. The working directory for sibyl is `/home/ph/code/trex-sibyl`, on branch `trex-sibyl-shell`.

---

## File Structure

```
trex-sibyl/
  index.html                       # SystemJS bootstrap; registers vue, vue-router, vuetify
  package.json, vite.config.ts, vitest.config.ts, playwright.config.ts
  tsconfig.json, tsconfig.node.json
  .gitignore
  public/
    config/plugins.json            # EMPTY plugin list
    vendor/{system.js,named-register.js,vue.global.js,vue-router.global.js}  # copied from Atlas3
  src/
    env.d.ts
    main.ts                        # bootstrap Vue+Vuetify+Pinia+Router, expose __atlasVuetify, init framework
    App.vue                        # shell layout: app bar + nav drawer + <router-view>
    components/NavBar.vue          # nav list from plugin menu items + empty state
    views/HomeView.vue             # landing / no-plugins message
    models/PluginModels.ts         # PORT verbatim
    services/PluginConfigService.ts# PORT verbatim
    services/auth/authStub.ts      # no-auth AuthContext
    utils/logger.ts                # PORT verbatim
    plugins/
      index.ts                     # PORT (adapted: no domain coupling)
      vuetify.ts                   # ADAPTED (inline theme, no @/ui)
      core/PluginRegistry.ts       # PORT verbatim
      core/PluginLoader.ts         # ADAPTED (strip webapi/storage/dataset)
      core/PluginIsolation.ts      # PORT verbatim
      messaging/HostMessageBus.ts  # PORT verbatim
      messaging/MessageTypes.ts    # PORT verbatim
      navigation/PluginRoutes.ts   # PORT verbatim
      navigation/PluginMenuIntegration.ts  # PORT verbatim
      components/PluginContainer.vue# ADAPTED (inline loading/error)
    router/index.ts                # createRouter + home + plugin catch-all
  tests/
    setup.ts
    PluginConfigService.spec.ts
    PluginLoader.spec.ts
    e2e/shell.spec.ts              # empty-state smoke
    e2e/plugin-mount.spec.ts       # fixture mount via route interception
    fixtures/hello-fixture-plugin/ # test-only plugin; built into public/plugins/ (gitignored)
```

**"PORT verbatim"** means: copy the file from the given `$A/...` path with **no content changes** except where a step says otherwise. These files import only `@/models/...`, `@/utils/logger`, `single-spa`, `vue-router`, and `zod` — all of which exist in sibyl with identical paths.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/env.d.ts`, `src/main.ts` (temporary), `src/App.vue` (temporary), `public/config/plugins.json`
- Copy: `public/vendor/{system.js,named-register.js,vue.global.js,vue-router.global.js}`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "trex-sibyl",
  "version": "0.1.0",
  "description": "ATLAS-plugin host shell for Strategus",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "type-check": "vue-tsc --noEmit",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "build:fixture": "vite build -c tests/fixtures/hello-fixture-plugin/vite.config.mjs",
    "check-all": "vue-tsc --noEmit && vitest run && vite build"
  },
  "dependencies": {
    "pinia": "^2.1.0",
    "single-spa": "^6.0.0",
    "vue": "^3.4.0",
    "vue-router": "^4.2.0",
    "vuetify": "^3.5.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@mdi/font": "^7.4.0",
    "@playwright/test": "^1.45.0",
    "@vitejs/plugin-vue": "^5.2.4",
    "jsdom": "^24.0.0",
    "single-spa-vue": "^3.0.0",
    "typescript": "^5.9.0",
    "vite": "^5.4.21",
    "vite-plugin-vuetify": "^2.0.0",
    "vitest": "^3.2.1",
    "vue-tsc": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`** — copy verbatim from `$A/tsconfig.json`.

- [ ] **Step 3: Create `tsconfig.node.json`** — copy verbatim from `$A/tsconfig.node.json`.

- [ ] **Step 4: Create `vite.config.ts`** (Atlas3's config minus the WebAPI proxy)

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
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
  server: { port: 5173, strictPort: true },
})
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
coverage/
playwright-report/
test-results/
*.local
.DS_Store
# test-only built fixture bundle (rebuilt on demand)
public/plugins/
```

- [ ] **Step 6: Create `src/env.d.ts`**

```ts
/// <reference types="vite/client" />

interface Window {
  System: {
    import: (id: string) => Promise<unknown>
    register: (name: string, deps: string[], fn: unknown) => void
    set: (name: string, mod: unknown) => void
  }
  Vue: unknown
  VueRouter: unknown
  __atlasVuetify?: unknown
  __pluginLoader?: { retryPlugin: (id: string) => void }
  __pluginRegistry?: unknown
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
```

- [ ] **Step 7: Create `index.html`** (Atlas3's bootstrap, React + single-spa-vue registrations removed; plugins bundle their own single-spa-vue)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <link rel="icon" href="/favicon.ico">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Strategus Shell</title>
    <script src="%BASE_URL%vendor/system.js"></script>
    <script src="%BASE_URL%vendor/named-register.js"></script>
    <script src="%BASE_URL%vendor/vue.global.js"></script>
    <script src="%BASE_URL%vendor/vue-router.global.js"></script>
    <script>
      (function () {
        'use strict'
        if (!window.System) { console.error('[SystemJS] window.System unavailable'); return }
        if (!window.Vue) { console.error('[SystemJS] window.Vue unavailable'); return }

        window.System.register('vue', [], function (_export) {
          return {
            setters: [],
            execute: function () {
              _export('default', window.Vue)
              Object.keys(window.Vue).forEach(function (key) { _export(key, window.Vue[key]) })
            },
          }
        })

        window.System.register('vue-router', [], function (_export) {
          return {
            setters: [],
            execute: function () {
              _export('default', window.VueRouter)
              _export('createRouter', window.VueRouter.createRouter)
              _export('createWebHistory', window.VueRouter.createWebHistory)
              _export('useRouter', window.VueRouter.useRouter)
              _export('useRoute', window.VueRouter.useRoute)
            },
          }
        })

        // Plugins that externalize vuetify resolve to the host singleton on
        // window.__atlasVuetify (set in src/main.ts).
        window.System.register('vuetify', [], function (_export) {
          return { setters: [], execute: function () { _export('default', window.__atlasVuetify) } }
        })
        window.System.register('vuetify/components', [], function (_export) {
          return { setters: [], execute: function () { _export(window.__atlasVuetify ? window.__atlasVuetify.components || {} : {}) } }
        })
        window.System.register('vuetify/directives', [], function (_export) {
          return { setters: [], execute: function () { _export(window.__atlasVuetify ? window.__atlasVuetify.directives || {} : {}) } }
        })
      })()
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 8: Copy vendor assets**

Run:
```bash
mkdir -p public/vendor public/config
cp /home/ph/code/Atlas3/public/vendor/system.js public/vendor/
cp /home/ph/code/Atlas3/public/vendor/named-register.js public/vendor/
cp /home/ph/code/Atlas3/public/vendor/vue.global.js public/vendor/
cp /home/ph/code/Atlas3/public/vendor/vue-router.global.js public/vendor/
```

- [ ] **Step 9: Create empty `public/config/plugins.json`**

```json
{
  "version": "1.0",
  "plugins": []
}
```

- [ ] **Step 10: Create temporary `src/App.vue`** (replaced in Task 8)

```vue
<template>
  <div>sibyl shell scaffold</div>
</template>
<script setup lang="ts"></script>
```

- [ ] **Step 11: Create temporary `src/main.ts`** (replaced in Task 8)

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 12: Install and verify dev server boots**

Run:
```bash
npm install
npx playwright install chromium
npm run build
```
Expected: `npm install` succeeds; `npm run build` completes with no type errors and emits `dist/`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold trex-sibyl shell project (vite, ts, vendor)"
```

---

## Task 2: Port plugin contract + utilities

**Files:**
- Create: `src/models/PluginModels.ts`, `src/utils/logger.ts`, `src/plugins/messaging/MessageTypes.ts`

- [ ] **Step 1: Port `src/utils/logger.ts`** — copy verbatim from `$A/src/utils/logger.ts`.

- [ ] **Step 2: Port `src/models/PluginModels.ts`** — copy verbatim from `$A/src/models/PluginModels.ts`.

- [ ] **Step 3: Port `src/plugins/messaging/MessageTypes.ts`** — copy verbatim from `$A/src/plugins/messaging/MessageTypes.ts`.

- [ ] **Step 4: Verify types compile**

Run: `npm run type-check`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: port plugin contract (PluginModels, MessageTypes, logger)"
```

---

## Task 3: PluginConfigService (TDD)

**Files:**
- Create: `tests/setup.ts`, `tests/PluginConfigService.spec.ts`, `src/services/PluginConfigService.ts`, `vitest.config.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['node_modules/', 'tests/e2e/**'],
    server: { deps: { inline: ['vuetify'] } },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

- [ ] **Step 2: Create `tests/setup.ts`**

```ts
// Global test setup. ResizeObserver is referenced by Vuetify components in jsdom.
import { vi } from 'vitest'

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// Silence visual-only matchMedia lookups in jsdom
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}
```

- [ ] **Step 3: Write the failing test `tests/PluginConfigService.spec.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test:unit -- PluginConfigService`
Expected: FAIL — cannot resolve `@/services/PluginConfigService` (file not created yet).

- [ ] **Step 5: Port `src/services/PluginConfigService.ts`** — copy verbatim from `$A/src/services/PluginConfigService.ts`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:unit -- PluginConfigService`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: PluginConfigService with manifest validation + tests"
```

---

## Task 4: Port registry, isolation, message bus

**Files:**
- Create: `src/plugins/core/PluginRegistry.ts`, `src/plugins/core/PluginIsolation.ts`, `src/plugins/messaging/HostMessageBus.ts`

- [ ] **Step 1: Port `src/plugins/core/PluginRegistry.ts`** — copy verbatim from `$A/src/plugins/core/PluginRegistry.ts`.

- [ ] **Step 2: Port `src/plugins/core/PluginIsolation.ts`** — copy verbatim from `$A/src/plugins/core/PluginIsolation.ts`.

- [ ] **Step 3: Port `src/plugins/messaging/HostMessageBus.ts`** — copy verbatim from `$A/src/plugins/messaging/HostMessageBus.ts`.

> Note: `HostMessageBus`'s `data:request` handler already returns the stub `{ success: true, data: {} }`. This is the intended sibyl behavior — no change.

- [ ] **Step 4: Verify types compile**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: port PluginRegistry, PluginIsolation, HostMessageBus"
```

---

## Task 5: Adapt PluginLoader (TDD)

The Atlas3 loader couples to `@/stores/webapi` and `@/services/auth/storageManager` for dataset switching. Sibyl strips that; `customProps` provides only what the Strategus plugin reads.

**Files:**
- Create: `tests/PluginLoader.spec.ts`, `src/plugins/core/PluginLoader.ts`

- [ ] **Step 1: Write the failing test `tests/PluginLoader.spec.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const registerApplication = vi.fn()
const start = vi.fn()
const triggerAppChange = vi.fn()
const getAppNames = vi.fn().mockReturnValue([])
const getAppStatus = vi.fn()

vi.mock('single-spa', () => ({
  registerApplication: (...a: unknown[]) => registerApplication(...a),
  start: (...a: unknown[]) => start(...a),
  triggerAppChange: (...a: unknown[]) => triggerAppChange(...a),
  getAppNames: (...a: unknown[]) => getAppNames(...a),
  getAppStatus: (...a: unknown[]) => getAppStatus(...a),
}))

import { PluginLoader } from '@/plugins/core/PluginLoader'
import { PluginRegistry } from '@/plugins/core/PluginRegistry'
import { createHostMessageBus } from '@/plugins/messaging/HostMessageBus'
import type { AuthContext, PluginRegistration } from '@/models/PluginModels'

const authStub: AuthContext = {
  user: { id: 'dev', username: 'dev', permissions: [] },
  token: null,
  isAuthenticated: true,
  hasPermission: () => true,
}

const registration: PluginRegistration = {
  id: 'demo-plugin',
  name: 'Demo',
  version: '0.1.0',
  entryPoint: 'demo-plugin/index.system.js',
  menuItems: [],
}

describe('PluginLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.System = {
      import: vi.fn().mockResolvedValue({
        bootstrap: vi.fn(),
        mount: vi.fn(),
        unmount: vi.fn(),
      }),
      register: vi.fn(),
      set: vi.fn(),
    } as unknown as Window['System']
  })

  it('imports the plugin from the resolved /plugins/ URL and registers it', async () => {
    const registry = new PluginRegistry()
    const instance = registry.registerPlugin(registration, authStub, createHostMessageBus('demo-plugin'))
    const loader = new PluginLoader(registry)

    await loader.loadPlugin(instance)

    expect(window.System.import).toHaveBeenCalledWith('/plugins/demo-plugin/index.system.js')
    expect(registerApplication).toHaveBeenCalledTimes(1)
    const arg = registerApplication.mock.calls[0][0] as { name: string; customProps: () => Record<string, unknown> }
    expect(arg.name).toBe('demo-plugin')
    const props = arg.customProps()
    expect(props.uiFilesUrl).toBe('/plugins/demo-plugin/')
    expect(props.authContext).toBe(authStub)
    expect(props.messageBus).toBeDefined()
    expect(registry.getPlugin('demo-plugin')?.state).toBe('loaded')
  })

  it('startPluginFramework calls single-spa start', () => {
    const registry = new PluginRegistry()
    const loader = new PluginLoader(registry)
    loader.startPluginFramework()
    expect(start).toHaveBeenCalledWith({ urlRerouteOnly: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- PluginLoader`
Expected: FAIL — cannot resolve `@/plugins/core/PluginLoader`.

- [ ] **Step 3: Create `src/plugins/core/PluginLoader.ts`** (adapted: no webapi store, no storageManager, no dataset watcher)

```ts
import { registerApplication, start, triggerAppChange, getAppNames, getAppStatus } from 'single-spa'
import { PluginRegistry } from './PluginRegistry'
import { PluginInstance } from '@/models/PluginModels'
import { logger } from '@/utils/logger'

export class PluginLoader {
  private registry: PluginRegistry
  private loadingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private retryAttempts: Map<string, number> = new Map()
  private readonly MAX_RETRIES = 3
  private readonly LOADING_TIMEOUT = 30000

  constructor(registry: PluginRegistry) {
    this.registry = registry
  }

  async loadPlugin(plugin: PluginInstance): Promise<void> {
    const { registration } = plugin
    const isAbsolutePath =
      registration.entryPoint.startsWith('/') || registration.entryPoint.startsWith('http')
    const pluginUrl = isAbsolutePath
      ? registration.entryPoint
      : `${import.meta.env.BASE_URL}/plugins/${registration.entryPoint}`.replace('//', '/')

    logger.info('PluginLoader', `Loading plugin: ${registration.id} from ${pluginUrl}`)

    try {
      this.registry.updatePluginState(registration.id, 'loading')
      const startTime = performance.now()

      const timeoutId = setTimeout(() => {
        const error = new Error(
          `Plugin ${registration.id} loading timeout after ${this.LOADING_TIMEOUT}ms`
        )
        this.registry.setPluginError(registration.id, error, true)
      }, this.LOADING_TIMEOUT)
      this.loadingTimeouts.set(registration.id, timeoutId)

      let pluginModule: {
        bootstrap: (props: unknown) => Promise<void>
        mount: (props: unknown) => Promise<void>
        unmount: (props: unknown) => Promise<void>
        update?: (props: unknown) => Promise<void>
      }

      try {
        if (!window.System) {
          throw new Error('SystemJS is not available')
        }
        const importedModule = await window.System.import(pluginUrl).catch((err: Error) => {
          throw new Error(`Failed to import plugin module: ${err.message}`)
        })
        pluginModule = importedModule as typeof pluginModule

        if (!pluginModule.bootstrap || !pluginModule.mount || !pluginModule.unmount) {
          throw new Error(
            `Plugin ${registration.id} is missing required lifecycle methods (bootstrap, mount, unmount)`
          )
        }

        const loadTime = performance.now() - startTime
        this.registry.updatePluginMetrics(registration.id, { loadTime })
        clearTimeout(timeoutId)
        this.loadingTimeouts.delete(registration.id)
        this.registry.updatePluginState(registration.id, 'loaded')
        logger.info('PluginLoader', `Plugin ${registration.id} loaded in ${loadTime.toFixed(0)}ms`)
      } catch (error) {
        clearTimeout(timeoutId)
        this.loadingTimeouts.delete(registration.id)
        throw error
      }

      registerApplication({
        name: registration.id,
        app: () => Promise.resolve(pluginModule),
        activeWhen: location => {
          const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
          const pluginPath = `${basePath}/plugins/${registration.id}/`
          return location.pathname.startsWith(pluginPath)
        },
        customProps: () => {
          const containerId = `plugin-${registration.id}`
          const domElement = document.getElementById(containerId)
          return {
            name: registration.name,
            authContext: plugin.authContext,
            messageBus: plugin.messageBus,
            domElement,
            containerId,
            appId: registration.id,
            getToken: async () => plugin.authContext.token ?? '',
            username: plugin.authContext.user?.username,
            idpUserId: plugin.authContext.user?.id,
            locale: document.documentElement.lang || 'en',
            isAtlas: true,
            autoMount: false,
            uiFilesUrl: `${import.meta.env.BASE_URL}plugins/${registration.id}/`.replace('//', '/'),
          }
        },
      })

      plugin.application = { name: registration.id }
    } catch (error) {
      logger.error('PluginLoader', `Failed to load plugin ${registration.id}`, error)
      this.handleLoadError(registration.id, error as Error)
    }
  }

  private handleLoadError(pluginId: string, error: Error): void {
    const attempts = this.retryAttempts.get(pluginId) || 0
    if (attempts < this.MAX_RETRIES) {
      this.retryAttempts.set(pluginId, attempts + 1)
      logger.info('PluginLoader', `Retry ${attempts + 1}/${this.MAX_RETRIES} for plugin ${pluginId}`)
      setTimeout(() => {
        const plugin = this.registry.getPlugin(pluginId)
        if (plugin) {
          this.loadPlugin(plugin)
        }
      }, 1000 * (attempts + 1))
    } else {
      this.registry.setPluginError(pluginId, error, false)
      this.retryAttempts.delete(pluginId)
    }
  }

  async retryPlugin(pluginId: string): Promise<void> {
    const plugin = this.registry.getPlugin(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }
    if (plugin.error) {
      plugin.error = undefined
    }
    this.retryAttempts.delete(pluginId)
    await this.loadPlugin(plugin)
  }

  startPluginFramework(): void {
    start({ urlRerouteOnly: true })
    logger.info('PluginLoader', 'Plugin framework started')
    ;(
      window as unknown as {
        __singleSpa: {
          getAppNames: typeof getAppNames
          getAppStatus: typeof getAppStatus
          triggerAppChange: typeof triggerAppChange
        }
      }
    ).__singleSpa = { getAppNames, getAppStatus, triggerAppChange }
    setTimeout(() => triggerAppChange(), 100)
  }

  dispose(): void {
    this.loadingTimeouts.forEach(timeout => clearTimeout(timeout))
    this.loadingTimeouts.clear()
    this.retryAttempts.clear()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- PluginLoader`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: PluginLoader adapted for sibyl (no domain coupling) + tests"
```

---

## Task 6: Vuetify, navigation, plugin container

**Files:**
- Create: `src/plugins/vuetify.ts`, `src/plugins/navigation/PluginRoutes.ts`, `src/plugins/navigation/PluginMenuIntegration.ts`, `src/plugins/components/PluginContainer.vue`, `src/plugins/index.ts`

- [ ] **Step 1: Create `src/plugins/vuetify.ts`** (inlined theme — no `@/ui` dependency)

```ts
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export function createVuetifyInstance(primaryColor?: string | null) {
  return createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary: primaryColor || '#1f425a',
            secondary: '#424242',
            accent: '#2d5f7f',
            error: '#b00020',
            info: '#2196f3',
            success: '#4caf50',
            warning: '#fb8c00',
          },
        },
      },
    },
    defaults: {
      VBtn: {
        variant: 'flat',
        color: 'primary',
        rounded: 'lg',
        style: 'text-transform: none; letter-spacing: 0;',
      },
      VCard: { variant: 'flat', rounded: 'lg' },
      VTextField: { variant: 'outlined', density: 'compact', rounded: 'md' },
      VSelect: { variant: 'outlined', density: 'compact', rounded: 'md' },
      VAutocomplete: { variant: 'outlined', density: 'compact', rounded: 'md' },
      VDialog: { rounded: 'lg' },
      VChip: { variant: 'tonal', rounded: 'md', density: 'compact' },
      VAlert: { variant: 'tonal', rounded: 'md' },
    },
  })
}

export default createVuetifyInstance()
```

- [ ] **Step 2: Port `src/plugins/navigation/PluginMenuIntegration.ts`** — copy verbatim from `$A/src/plugins/navigation/PluginMenuIntegration.ts`.

- [ ] **Step 3: Port `src/plugins/navigation/PluginRoutes.ts`** — copy verbatim from `$A/src/plugins/navigation/PluginRoutes.ts`.

- [ ] **Step 4: Create `src/plugins/components/PluginContainer.vue`** (Atlas3's container with the loading/error UI inlined, removing the `PluginErrorUI`/`PluginLoadingState` sub-components)

```vue
<template>
  <div class="plugin-container">
    <div
      :id="pluginContainerId"
      class="plugin-mount-point"
      :class="{ 'plugin-mount-point--hidden': hasError || isLoading }"
    />
    <div v-if="hasError" class="plugin-overlay">
      <div class="plugin-state">
        <p class="plugin-state__title">Failed to load “{{ pluginId }}”</p>
        <p v-if="error" class="plugin-state__msg">{{ error.message }}</p>
        <button class="plugin-state__btn" @click="handleRetry">Retry</button>
      </div>
    </div>
    <div v-else-if="isLoading" class="plugin-overlay">
      <div class="plugin-state">
        <p class="plugin-state__title">Loading “{{ pluginId }}”…</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onErrorCaptured } from 'vue'
import { useRoute } from 'vue-router'
import { pluginRegistry } from '@/plugins/index'
import { logger } from '@/utils/logger'

const route = useRoute()
const pluginId = computed(() => route.params.pluginId as string)
const pluginContainerId = computed(() => `plugin-${pluginId.value}`)

const hasError = ref(false)
const error = ref<{ message: string; stack?: string; timestamp: Date; recoverable: boolean } | null>(null)
const isLoading = ref(true)

let stateUnsubscribe: (() => void) | null = null

onMounted(async () => {
  let plugin = null
  for (let attempt = 0; attempt < 20; attempt++) {
    plugin = pluginRegistry.getPlugin(pluginId.value)
    if (plugin) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  if (plugin) {
    hasError.value = plugin.state === 'error'
    error.value = plugin.error ?? null
    isLoading.value = plugin.state === 'loading' || plugin.state === 'not-loaded'
    stateUnsubscribe = pluginRegistry.onStateChange(pluginId.value, state => {
      hasError.value = state === 'error'
      isLoading.value = state === 'loading' || state === 'not-loaded'
      if (state === 'error') {
        error.value = pluginRegistry.getPlugin(pluginId.value)?.error ?? null
      }
    })
  } else {
    logger.error('PluginContainer', `Plugin ${pluginId.value} not found`)
    hasError.value = true
    isLoading.value = false
    error.value = { message: `Plugin ${pluginId.value} not found`, timestamp: new Date(), recoverable: false }
  }
})

onUnmounted(() => {
  if (stateUnsubscribe) stateUnsubscribe()
})

onErrorCaptured(err => {
  logger.error('PluginContainer', `Error captured for plugin ${pluginId.value}`, err)
  hasError.value = true
  error.value = { message: err.message, stack: err.stack, timestamp: new Date(), recoverable: true }
  return false
})

function handleRetry() {
  hasError.value = false
  error.value = null
  window.__pluginLoader?.retryPlugin(pluginId.value)
}
</script>

<style scoped>
.plugin-container { width: 100%; height: 100%; position: relative; }
.plugin-mount-point { width: 100%; height: 100%; }
.plugin-mount-point--hidden { visibility: hidden; position: absolute; top: 0; left: 0; }
.plugin-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  min-height: 400px; background: #fff; z-index: 10;
}
.plugin-state { text-align: center; }
.plugin-state__title { font-weight: 600; }
.plugin-state__msg { color: #b00020; margin-top: 0.5rem; }
.plugin-state__btn {
  margin-top: 1rem; padding: 0.5rem 1rem; border: none; border-radius: 6px;
  background: #1f425a; color: #fff; cursor: pointer;
}
</style>
```

- [ ] **Step 5: Create `src/plugins/index.ts`** (Atlas3's framework init, verbatim — it has no domain coupling)

```ts
import { pluginConfigService } from '@/services/PluginConfigService'
import { PluginRegistry, pluginRegistry } from './core/PluginRegistry'
import { PluginLoader } from './core/PluginLoader'
import { setupPluginIsolation } from './core/PluginIsolation'
import { createHostMessageBus } from './messaging/HostMessageBus'
import { AuthContext } from '@/models/PluginModels'
import { logger } from '@/utils/logger'

let pluginLoader: PluginLoader | null = null
let initialized = false

export async function initializePluginFramework(authContext: AuthContext): Promise<void> {
  if (initialized) {
    logger.warn('PluginFramework', 'Already initialized')
    return
  }
  try {
    logger.info('PluginFramework', 'Initializing...')
    setupPluginIsolation()
    const manifest = await pluginConfigService.loadConfig()
    logger.info('PluginFramework', `Loaded ${manifest.plugins.length} plugin(s)`)

    if (manifest.plugins.length === 0) {
      logger.info('PluginFramework', 'No plugins configured, skipping plugin loading')
      initialized = true
      return
    }

    pluginLoader = new PluginLoader(pluginRegistry)
    ;(window as unknown as { __pluginLoader: PluginLoader }).__pluginLoader = pluginLoader
    ;(window as unknown as { __pluginRegistry: PluginRegistry }).__pluginRegistry = pluginRegistry

    for (const registration of manifest.plugins) {
      const messageBus = createHostMessageBus(registration.id)
      const instance = pluginRegistry.registerPlugin(registration, authContext, messageBus)
      await pluginLoader.loadPlugin(instance)
    }

    pluginLoader.startPluginFramework()
    pluginConfigService.setupHotReload()
    initialized = true
    logger.info('PluginFramework', 'Initialization complete')
  } catch (error) {
    logger.error('PluginFramework', 'Initialization failed', error)
    logger.warn('PluginFramework', 'Continuing without plugin support')
    initialized = true
  }
}

export function getPluginRegistry(): PluginRegistry {
  return pluginRegistry
}

export function getPluginLoader(): PluginLoader | null {
  return pluginLoader
}

export { pluginRegistry }
```

- [ ] **Step 6: Verify types compile**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: vuetify instance, plugin navigation, PluginContainer, framework init"
```

---

## Task 7: Auth stub + router

**Files:**
- Create: `src/services/auth/authStub.ts`, `src/router/index.ts`, `src/views/HomeView.vue`

- [ ] **Step 1: Create `src/services/auth/authStub.ts`**

```ts
import { AuthContext } from '@/models/PluginModels'

// v1 has no authentication. This dev context satisfies the plugin contract
// and grants all permissions. Swap for real auth later without touching plugins.
export const authStub: AuthContext = {
  user: {
    id: 'dev-user',
    username: 'dev',
    email: 'dev@localhost',
    permissions: ['*'],
  },
  token: null,
  isAuthenticated: true,
  hasPermission: () => true,
}
```

- [ ] **Step 2: Create `src/views/HomeView.vue`**

```vue
<template>
  <v-container class="py-10">
    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="pa-6">
          <h1 class="text-h5 mb-2">Strategus Shell</h1>
          <p class="text-body-1 mb-4">
            ATLAS-plugin host shell. Strategus plugins appear in the navigation
            drawer once registered in <code>public/config/plugins.json</code>.
          </p>
          <v-alert v-if="!hasPlugins" type="info" variant="tonal" data-test="no-plugins">
            No plugins are currently registered.
          </v-alert>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { generatePluginMenuItems } from '@/plugins/navigation/PluginMenuIntegration'

const hasPlugins = computed(() => generatePluginMenuItems().length > 0)
</script>
```

- [ ] **Step 3: Create `src/router/index.ts`**

```ts
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { generatePluginRoutes } from '@/plugins/navigation/PluginRoutes'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView },
  ...generatePluginRoutes(),
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
```

- [ ] **Step 4: Verify types compile**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: auth stub, router with plugin catch-all, home view"
```

---

## Task 8: Shell UI + bootstrap

**Files:**
- Create: `src/components/NavBar.vue`
- Replace: `src/App.vue`, `src/main.ts`

- [ ] **Step 1: Create `src/components/NavBar.vue`**

```vue
<template>
  <v-navigation-drawer permanent>
    <v-list nav density="compact">
      <v-list-item
        :to="'/'"
        prepend-icon="mdi-home-outline"
        title="Home"
        data-test="nav-home"
      />
      <v-divider class="my-2" />
      <v-list-subheader>Plugins</v-list-subheader>
      <v-list-item
        v-for="item in menuItems"
        :key="item.id"
        :to="item.route"
        :prepend-icon="item.icon || 'mdi-puzzle-outline'"
        :title="item.name"
        :data-test="`nav-${item.pluginId}`"
      />
      <v-list-item v-if="menuItems.length === 0" data-test="nav-empty">
        <v-list-item-subtitle>No plugins registered</v-list-item-subtitle>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  generatePluginMenuItems,
  type PluginMenuItem,
} from '@/plugins/navigation/PluginMenuIntegration'

// Menu items are computed once after the framework has registered plugins
// during bootstrap (see main.ts ordering). A ref keeps it simple and reactive
// to a manual refresh if needed.
const menuItems = ref<PluginMenuItem[]>(generatePluginMenuItems())
</script>
```

- [ ] **Step 2: Replace `src/App.vue`**

```vue
<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <v-app-bar-title>Strategus Shell</v-app-bar-title>
    </v-app-bar>
    <NavBar />
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import NavBar from '@/components/NavBar.vue'
</script>
```

- [ ] **Step 3: Replace `src/main.ts`**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { createVuetifyInstance } from './plugins/vuetify'
import { initializePluginFramework } from './plugins/index'
import { setupGlobalMessageHandler } from './plugins/messaging/HostMessageBus'
import { authStub } from './services/auth/authStub'
import { logger } from './utils/logger'

async function bootstrap() {
  const app = createApp(App)

  const vuetify = createVuetifyInstance()
  // Expose the host Vuetify singleton so plugins that externalize `vuetify`
  // resolve to it via SystemJS (see index.html).
  ;(window as unknown as { __atlasVuetify?: unknown }).__atlasVuetify = vuetify

  app.use(createPinia())
  app.use(router)
  app.use(vuetify)

  setupGlobalMessageHandler(router)

  app.mount('#app')

  try {
    await initializePluginFramework(authStub)
  } catch (error) {
    logger.error('main', 'Plugin framework initialization failed', error)
  }
}

bootstrap()
```

- [ ] **Step 4: Verify build and manual dev boot**

Run:
```bash
npm run build
npm run dev &
sleep 4
curl -s http://localhost:5173 | grep -q 'id="app"' && echo "SHELL_OK"
kill %1
```
Expected: build passes; output includes `SHELL_OK`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: shell layout (app bar, nav drawer, router-view) + bootstrap"
```

---

## Task 9: Empty-state e2e smoke test

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/shell.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build:fixture && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

- [ ] **Step 2: Write `tests/e2e/shell.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test('shell boots and shows the empty no-plugins state', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.v-app-bar')).toContainText('Strategus Shell')
  await expect(page.getByTestId('no-plugins')).toBeVisible()
  await expect(page.getByTestId('nav-empty')).toBeVisible()
})
```

- [ ] **Step 3: Run the test**

Run: `npm run test:e2e -- shell`
Expected: PASS (1 test). (`build:fixture` runs as part of webServer startup — Task 10 creates the fixture; until then, temporarily set the webServer command to just `npm run dev` to run this test in isolation, then restore it in Task 10 Step 6.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: e2e smoke for empty shell state"
```

---

## Task 10: Test-only fixture plugin proves loading

This proves the shell can actually mount a plugin without shipping one in production. The fixture is built to `public/plugins/` (gitignored) and injected into the manifest by the test via route interception.

**Files:**
- Create: `tests/fixtures/hello-fixture-plugin/{package.json,vite.config.mjs,src/main.ts,src/App.vue,tsconfig.json}`, `tests/e2e/plugin-mount.spec.ts`

- [ ] **Step 1: Create `tests/fixtures/hello-fixture-plugin/package.json`**

```json
{
  "name": "hello-fixture-plugin",
  "version": "1.0.0",
  "description": "Test-only fixture plugin for trex-sibyl loader verification",
  "type": "module"
}
```

- [ ] **Step 2: Create `tests/fixtures/hello-fixture-plugin/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

- [ ] **Step 3: Create `tests/fixtures/hello-fixture-plugin/vite.config.mjs`** (absolute paths via `import.meta.url` so it builds regardless of cwd)

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      formats: ['system'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue'],
      output: { format: 'system', globals: { vue: 'vue' } },
    },
    outDir: fileURLToPath(new URL('../../../public/plugins/hello-fixture-plugin', import.meta.url)),
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})
```

- [ ] **Step 4: Create `tests/fixtures/hello-fixture-plugin/src/main.ts`**

```ts
import { h, createApp } from 'vue'
import singleSpaVue from 'single-spa-vue'
import App from './App.vue'

const vueLifecycles = singleSpaVue({
  createApp,
  appOptions: {
    render() {
      return h(App)
    },
  },
})

export const bootstrap = vueLifecycles.bootstrap
export const mount = vueLifecycles.mount
export const unmount = vueLifecycles.unmount
```

- [ ] **Step 5: Create `tests/fixtures/hello-fixture-plugin/src/App.vue`**

```vue
<template>
  <div data-test="fixture-root" style="padding: 2rem">
    <h1>Hello Fixture Plugin</h1>
    <p>Mounted by trex-sibyl host shell.</p>
  </div>
</template>

<script setup lang="ts"></script>
```

- [ ] **Step 6: Restore `playwright.config.ts` webServer command**

Ensure the `webServer.command` in `playwright.config.ts` is:
```
command: 'npm run build:fixture && npm run dev',
```
(If it was temporarily changed in Task 9 Step 3, restore it now.)

- [ ] **Step 7: Verify the fixture builds**

Run: `npm run build:fixture`
Expected: emits `public/plugins/hello-fixture-plugin/index.system.js` (and `style.css`). Confirm with `ls public/plugins/hello-fixture-plugin`.

- [ ] **Step 8: Write `tests/e2e/plugin-mount.spec.ts`** (inject a manifest pointing at the built fixture via route interception)

```ts
import { test, expect } from '@playwright/test'

const fixtureManifest = {
  version: '1.0',
  plugins: [
    {
      id: 'hello-fixture-plugin',
      name: 'Hello Fixture',
      version: '1.0.0',
      entryPoint: 'hello-fixture-plugin/index.system.js',
      menuItems: [
        {
          id: 'main',
          name: 'Hello Fixture',
          route: '/plugins/hello-fixture-plugin/',
          icon: 'mdi-hand-wave-outline',
        },
      ],
    },
  ],
}

test('host loads and mounts a plugin from the manifest', async ({ page }) => {
  // Serve our test manifest in place of the empty production one.
  await page.route('**/config/plugins.json', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtureManifest),
    })
  )

  await page.goto('/plugins/hello-fixture-plugin/')

  // Plugin nav item rendered from the manifest, and the plugin mounted.
  await expect(page.getByTestId('nav-hello-fixture-plugin')).toBeVisible()
  await expect(page.getByTestId('fixture-root')).toBeVisible()
  await expect(page.getByTestId('fixture-root')).toContainText('Hello Fixture Plugin')
})
```

- [ ] **Step 9: Run the mounting test**

Run: `npm run test:e2e -- plugin-mount`
Expected: PASS — the fixture mounts at its route.

- [ ] **Step 10: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: PASS (shell smoke + plugin mount).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "test: fixture plugin proves end-to-end host loading"
```

---

## Task 11: README + final verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# trex-sibyl

ATLAS-plugin **host shell** dedicated to Strategus-related plugins. Sibling to
Atlas3; implements the same plugin contract (SystemJS + single-spa, `plugins.json`)
but carries none of Atlas3's OHDSI domain UI.

## Develop

    npm install
    npx playwright install chromium
    npm run dev        # http://localhost:5173

Ships empty: no plugins are registered. To host a plugin, drop its built bundle
into `public/plugins/<id>/` and add an entry to `public/config/plugins.json`
(menu routes must start with `/plugins/<id>/`). The Strategus plugin will be
moved in this way later.

## Test

    npm run test:unit  # Vitest: config + loader
    npm run test:e2e   # Playwright: empty-state smoke + fixture mount
    npm run check-all  # type-check + unit + build

`tests/fixtures/hello-fixture-plugin/` is a test-only plugin used by the e2e
mount test; it is built into `public/plugins/` (gitignored) on demand.

## Architecture

See `docs/superpowers/specs/2026-05-29-trex-sibyl-shell-design.md`.

## Follow-ups

- Move the Strategus plugin in.
- Wire `data:request` (`HostMessageBus`) to a real cohort source.
- Real authentication (replace `src/services/auth/authStub.ts`).
- Docker/Caddy deployment parity with Atlas3.
```

- [ ] **Step 2: Run full verification**

Run: `npm run check-all && npm run test:e2e`
Expected: type-check passes, all unit tests pass, build succeeds, all e2e tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: README for trex-sibyl shell"
```

---

## Self-Review Notes (for the implementer)

- **Verbatim ports** (`PluginModels`, `MessageTypes`, `logger`, `PluginConfigService`, `PluginRegistry`, `PluginIsolation`, `HostMessageBus`, `PluginRoutes`, `PluginMenuIntegration`, `plugins/index.ts`) rely on the same `@/` import paths that exist in sibyl — verify `npm run type-check` after each.
- **`PluginRegistry`** exposes `updatePluginState`, `setPluginError`, `updatePluginMetrics`, `onStateChange`, `getPlugin`, `registerPlugin` — all used by `PluginLoader`, `PluginContainer`, and `plugins/index.ts`. If a port reports a missing method, re-copy the file from `$A` (do not hand-edit).
- **The only intentional divergence from Atlas3** is `PluginLoader` (dropped webapi/storage/dataset code) and `vuetify.ts` (inlined theme). Everything else matches.
- **Empty-state path:** `plugins.json` with `plugins: []` → `initializePluginFramework` returns early → `generatePluginMenuItems()` returns `[]` → Home shows `data-test="no-plugins"`, NavBar shows `data-test="nav-empty"`.
```
