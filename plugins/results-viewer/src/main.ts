import { h, createApp } from 'vue'
import singleSpaVue from 'single-spa-vue'
import { createVuetify } from 'vuetify'
import App from './App.vue'
import { pluginBase } from './pluginBase'

// Ensure our compiled stylesheet is in <head> even if the host parcel
// loader skipped the CSS injection step. Idempotent — no-op on remount.
function ensureStylesheet() {
  const STYLE_URL = `${pluginBase()}style.css`
  const id = 'plugin-results-viewer-style'
  if (typeof document === 'undefined') return
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = STYLE_URL
  document.head.appendChild(link)
}
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
// Buttons get Atlas-style appearance from the .rv-* scoped CSS instead.
function createParcelVuetify() {
  return createVuetify({ theme: false })
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

export const bootstrap = vueLifecycles.bootstrap
export const mount = vueLifecycles.mount
export const unmount = vueLifecycles.unmount
