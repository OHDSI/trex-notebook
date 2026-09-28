// Where the Pyodide worker loads its runtime from.
//
// loadPyodide refuses to start when the CDN build does not match the version of
// the bundled `pyodide` JS package ("Pyodide version does not match"), and the
// notebook package's worker falls back to a hardcoded v0.29.0. That silently
// killed the Python kernel once the installed package moved to 0.29.4, so the
// version is injected at build time from the actually-resolved package (see
// vite.config.ts) instead of being written down twice.
declare const __PYODIDE_VERSION__: string

/** Resolved at build time; empty only in a context with no define (e.g. raw ts-node). */
export const pyodideVersion: string =
  typeof __PYODIDE_VERSION__ !== 'undefined' ? __PYODIDE_VERSION__ : ''

/**
 * CDN index URL matching the bundled pyodide package, or undefined when the
 * version is unknown — in which case the worker keeps its own fallback rather
 * than being handed a URL built from an empty version.
 */
export const pyodideIndexUrl: string | undefined = pyodideVersion
  ? `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`
  : undefined
