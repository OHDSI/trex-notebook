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
