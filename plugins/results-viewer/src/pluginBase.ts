// Resolve the URL prefix this plugin is served under, at runtime.
//
// results-viewer is a single-spa parcel loaded by a host shell. It is served
// under a path that always carries the marker below plus whatever prefix the
// host itself is mounted at:
//   - sibyl standalone (base `/`):      /plugins/results-viewer/...
//   - sibyl under trex (base /plugins/sibyl/): /plugins/sibyl/plugins/results-viewer/...
//
// A single committed bundle serves every deployment without a build-time base
// flag. Used for the stylesheet href, the shinylive iframe src, and the httpuv
// service-worker path + scope.
//
// IMPORTANT: derive the base from the bundle's OWN url (import.meta.url), NOT
// the live `location`. single-spa LOADS this bundle eagerly — often while a
// different route is active — and the top-level stylesheet injection in main.ts
// runs at load time. Deriving from `location.pathname` then found no marker,
// produced `/plugins/results-viewer/style.css` (missing the host's
// `/plugins/sibyl` prefix), 404'd to text/html, and the browser refused the
// stylesheet — so styles only appeared after a reload that happened to be on
// the plugin's own route. The bundle url always sits under the plugin path, so
// it resolves correctly no matter which route is active.
const MARKER = '/plugins/results-viewer/'

let cachedBase: string | null = null

function baseFromPath(pathname: string): string | null {
  const i = pathname.indexOf(MARKER)
  if (i < 0) return null
  return `${pathname.slice(0, i)}${MARKER}`
}

export function pluginBase(): string {
  if (cachedBase) return cachedBase
  // 1. Prefer the bundle's own URL — stable regardless of the active route.
  try {
    const fromSelf = baseFromPath(new URL(import.meta.url).pathname)
    if (fromSelf) return (cachedBase = fromSelf)
  } catch {
    // import.meta.url unavailable (non-module context) — fall through.
  }
  // 2. Fall back to the live location (correct only while on the plugin route).
  if (typeof location !== 'undefined') {
    const fromLoc = baseFromPath(location.pathname)
    if (fromLoc) return (cachedBase = fromLoc)
  }
  // 3. Last resort: the bare marker.
  return MARKER
}
