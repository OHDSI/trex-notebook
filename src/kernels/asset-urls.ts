export interface KernelAssetUrls {
  /** Pyodide loadPyodide indexURL */
  pyodideIndexUrl: string
  /** WebR WASM base URL (undefined → WebR uses its CDN default) */
  webrBaseUrl?: string
  /** WebR package repo URL (undefined → WebR uses its CDN default) */
  webrRepoUrl?: string
}

/**
 * Resolve kernel asset URLs.
 *
 * - `assetBase` non-empty (production build): all kernels load from local,
 *   origin-relative paths under that base — fully offline, no CDN calls.
 * - `assetBase` empty (dev server): fall back to public CDNs.
 */
export function buildKernelAssetUrls(
  assetBase: string,
  pyodideVersion: string
): KernelAssetUrls {
  if (assetBase) {
    const base = assetBase.replace(/\/+$/, '')
    return {
      pyodideIndexUrl: `${base}/pyodide/`,
      webrBaseUrl: `${base}/webr/`,
      webrRepoUrl: `${base}/webr-repo/`,
    }
  }
  return {
    pyodideIndexUrl: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
    webrBaseUrl: undefined,
    webrRepoUrl: undefined,
  }
}
