import { describe, it, expect } from 'vitest'
import { pyodideVersion, pyodideIndexUrl } from './pyodideAssets'

// This deliberately asserts no particular version. The resolved pyodide differs
// by environment — the lib's lockfile pins 0.29.0, while a hoisted install in
// the d2e monorepo satisfies the same ^0.29.0 range with 0.29.4 — so any
// hardcoded version is wrong somewhere, which is the bug this module exists to
// prevent. It also cannot import pyodide to compare: pyodide is a dependency of
// ../notebook, not of this package, and is absent from its node_modules in CI.
// The build-time guarantee lives in vite.config.ts, which resolves the version
// from the lib and throws if it cannot; these assert the contract it must meet.
describe('pyodide asset urls', () => {
  it('has a real version injected at build time', () => {
    // Empty means the `define` never applied, leaving pyodideIndexUrl undefined
    // and the worker silently falling back to its own hardcoded URL — which is
    // only correct by luck, and shows up as a kernel stuck in the error state
    // with nothing in the build log.
    expect(pyodideVersion).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('builds a CDN url for exactly the resolved version', () => {
    // loadPyodide rejects with "Pyodide version does not match" when the CDN
    // build and the bundled JS package disagree, so the URL has to track the
    // resolved package rather than any literal written down here.
    expect(pyodideIndexUrl).toBe(
      `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`
    )
  })
})
