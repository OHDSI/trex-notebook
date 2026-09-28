import { describe, it, expect } from 'vitest'
import { pyodideVersion, pyodideIndexUrl } from './pyodideAssets'

// NOTE: this deliberately does NOT import pyodide to compare versions. pyodide
// is a dependency of ../notebook, not of this package, so it is absent from
// this package's node_modules in CI (it resolves locally only through a hoisted
// install). The build-time guarantee lives in vite.config.ts, which resolves
// the version from the lib and throws if it cannot; what is worth asserting
// here is the contract that guarantee has to satisfy.
describe('pyodide asset urls', () => {
  it('has a real version injected at build time', () => {
    // Empty means the `define` never applied, in which case pyodideIndexUrl is
    // undefined and the worker silently falls back to its stale hardcoded URL —
    // a kernel that never leaves the error state, with nothing in the build log.
    expect(pyodideVersion).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('builds a CDN url for exactly that version', () => {
    expect(pyodideIndexUrl).toBe(
      `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`
    )
  })

  it('is not the notebook package\'s stale hardcoded fallback', () => {
    // The mismatch this whole mechanism exists to prevent: loadPyodide rejects
    // with "Pyodide version does not match" when the CDN build and the bundled
    // JS package disagree.
    expect(pyodideIndexUrl).not.toContain('v0.29.0/')
  })
})
