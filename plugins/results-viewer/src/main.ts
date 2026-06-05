import { h, createApp } from 'vue'
import singleSpaVue from 'single-spa-vue'
import { createVuetify } from 'vuetify'
import { buildVuetifyOptions } from '@ohdsi/atlas-ui'
import App from './App.vue'
import { pluginBase } from './pluginBase'

// Ensure our compiled stylesheet is in <head> even if the host parcel
// loader skipped the CSS injection step. Idempotent — no-op on remount.
function ensureStylesheet(): Promise<void> {
  const STYLE_URL = `${pluginBase()}style.css`
  const id = 'plugin-results-viewer-style'
  if (typeof document === 'undefined') return Promise.resolve()
  const existing = document.getElementById(id) as HTMLLinkElement | null
  if (existing) {
    return existing.dataset.loaded === 'true'
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          existing.addEventListener('load', () => resolve(), { once: true })
          existing.addEventListener('error', () => resolve(), { once: true })
        })
  }
  return new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = STYLE_URL
    // Resolve on load so mount() never paints before CSS applies; resolve (not
    // reject) on error so a missing file can't hang the parcel forever.
    link.addEventListener('load', () => { link.dataset.loaded = 'true'; resolve() }, { once: true })
    link.addEventListener('error', () => { link.dataset.loaded = 'true'; resolve() }, { once: true }) // mark settled so a remount doesn't await a dead listener
    document.head.appendChild(link)
  })
}
// Eager warm-up: start fetching the stylesheet immediately at module load time.
ensureStylesheet()

export interface PluginProps {
  name: string
  mountParcel?: unknown
  singleSpa?: unknown
  authContext: {
    user: { id?: string; username?: string; permissions?: string[] } | null
    token: string | null
    isAuthenticated: boolean
    hasPermission: (permission: string) => boolean
  }
  messageBus: {
    send: (type: string, payload: unknown) => void
    request: <T>(type: string, payload: unknown) => Promise<T>
    subscribe: (type: string, callback: (data: unknown) => void) => () => void
  }
}

// Parcel Vuetify with no theme override — sharing the host's Vuetify
// theme caused global cascade leaks into Atlas3 (theme tokens collided).
// We inherit the host CSS theme vars (theme: false) but apply Atlas shared
// defaults so Vuetify component props match the design system baseline.
function createParcelVuetify() {
  return createVuetify({ theme: false, defaults: buildVuetifyOptions().defaults })
}

const vueLifecycles = singleSpaVue({
  createApp,
  appOptions: {
    render() {
      return h(App, {
        name: (this as PluginProps).name,
        authContext: (this as PluginProps).authContext,
        messageBus: (this as PluginProps).messageBus,
      })
    },
  },
  handleInstance(app, props) {
    app.use(createParcelVuetify())
    app.provide('pluginProps', props)
  },
})

export const bootstrap = async (props: PluginProps) => {
  await ensureStylesheet()
  return vueLifecycles.bootstrap(props)
}
export const mount = vueLifecycles.mount
export const unmount = vueLifecycles.unmount
