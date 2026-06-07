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
  __sibylWebApiUrl?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
