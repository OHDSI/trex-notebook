import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { createVuetifyInstance } from './plugins/vuetify'
import { buildVuetifyOptions } from '@ohdsi/atlas-ui'
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
  // Sub-plugins create their own `createVuetify({ theme: false })` and read
  // window.__atlasUiConfig?.defaults for component defaults — publish the Atlas
  // defaults so they inherit the shared button/input/dialog shapes.
  ;(window as unknown as { __atlasUiConfig?: unknown }).__atlasUiConfig = {
    defaults: buildVuetifyOptions().defaults,
  }

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
