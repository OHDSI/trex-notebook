import { mountRootParcel, type Parcel } from 'single-spa'
import { pluginRegistry } from '@/plugins/core/PluginRegistry'

/**
 * Mount a registered plugin as a single-spa parcel into `domElement` (e.g. a
 * drawer body), independent of routing. Mirrors PluginLoader's URL + customProps
 * construction so the parcel receives the same context as a routed mount.
 */
export async function mountPluginParcel(pluginId: string, domElement: HTMLElement): Promise<Parcel> {
  const plugin = pluginRegistry.getPlugin(pluginId)
  if (!plugin) throw new Error(`Plugin ${pluginId} is not registered`)
  const { registration } = plugin

  const isAbsolute = registration.entryPoint.startsWith('/') || registration.entryPoint.startsWith('http')
  const pluginUrl = isAbsolute
    ? registration.entryPoint
    : `${import.meta.env.BASE_URL}/plugins/${registration.entryPoint}`.replace('//', '/')

  if (!window.System) throw new Error('SystemJS is not available')
  const lifecycles = await window.System.import(pluginUrl)

  const uiFilesUrl = `${import.meta.env.BASE_URL}plugins/${registration.id}/`.replace('//', '/')
  // containerId / autoMount / username / idpUserId (passed by PluginLoader for a
  // routed mount) are intentionally omitted: a DOM-targeted parcel doesn't need
  // them, and the jobs plugin only reads uiFilesUrl from its props (see jobs/src/main.ts).
  const parcel = mountRootParcel(lifecycles as Parameters<typeof mountRootParcel>[0], {
    domElement,
    name: registration.name,
    authContext: plugin.authContext,
    messageBus: plugin.messageBus,
    appId: registration.id,
    getToken: async () => plugin.authContext.token ?? '',
    locale: document.documentElement.lang || 'en',
    isAtlas: true,
    uiFilesUrl,
  } as { domElement: HTMLElement } & Record<string, unknown>)

  await parcel.mountPromise
  return parcel
}
