// Resolve the URL prefix this plugin is served under, at runtime.
//
// results-viewer is a single-spa parcel loaded by a host shell. The host
// activates it only when the current path contains `/plugins/results-viewer/`,
// so the path always carries that marker plus whatever prefix the host itself
// is mounted at:
//   - sibyl standalone (base `/`):      /plugins/results-viewer/...
//   - sibyl under trex (base /plugins/sibyl/): /plugins/sibyl/plugins/results-viewer/...
//
// Deriving the base from `location.pathname` lets a single committed bundle
// serve every deployment without a build-time base flag. Used for the stylesheet
// href, the shinylive iframe src, and the httpuv service-worker path + scope.
const MARKER = '/plugins/results-viewer/'

export function pluginBase(): string {
  if (typeof location === 'undefined') return MARKER
  const i = location.pathname.indexOf(MARKER)
  const prefix = i >= 0 ? location.pathname.slice(0, i) : ''
  return `${prefix}${MARKER}`
}
