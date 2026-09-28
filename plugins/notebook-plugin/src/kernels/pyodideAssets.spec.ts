import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { pyodideVersion, pyodideIndexUrl } from './pyodideAssets'

describe('pyodide asset urls', () => {
  const installed = JSON.parse(
    readFileSync(createRequire(import.meta.url).resolve('pyodide/package.json'), 'utf-8')
  ).version as string

  it('matches the installed pyodide package version', () => {
    // loadPyodide rejects with "Pyodide version does not match" when the CDN
    // build and the bundled JS package disagree, and the only symptom is a
    // kernel that never leaves the error state. Bumping pyodide without
    // rebuilding must fail here rather than in a user's browser.
    expect(pyodideVersion).toBe(installed)
  })

  it('builds a CDN url for that exact version', () => {
    expect(pyodideIndexUrl).toBe(`https://cdn.jsdelivr.net/pyodide/v${installed}/full/`)
  })

  it('is not the notebook package\'s stale hardcoded fallback', () => {
    expect(pyodideIndexUrl).not.toContain('v0.29.0/')
  })
})
