import { describe, it, expect } from 'vitest'
import { buildRD2EBootstrapCode } from './rD2EBootstrap'

describe('buildRD2EBootstrapCode', () => {
  const code = buildRD2EBootstrapCode()

  it('inlines the rD2E R source', () => {
    // Injected by vite `define` from src/kernels/rD2E.R. If the define is
    // dropped the bootstrap silently degrades to defining nothing, and
    // library(rD2E) would "succeed" while every rD2E function is missing.
    expect(code).toContain('get_cohort_definition_set')
    expect(code).toContain('run_strategus_flow')
    expect(code.length).toBeGreaterThan(1000)
  })

  it('never emits a literal library(rD2E)/require(rD2E) call', () => {
    // The WebR kernel pre-scans code for library()/require() and tries to
    // webr::install() what it finds. rD2E is not installable, so a literal call
    // here would make every connect() attempt a doomed install.
    expect(code).not.toMatch(/\b(library|require)\s*\(\s*rD2E\s*\)/)
  })

  it('installs jsonlite, rD2E\'s only external dependency', () => {
    expect(code).toMatch(/\blibrary\s*\(\s*jsonlite\s*\)/)
  })

  it('attaches the rD2E functions under the name "rD2E"', () => {
    expect(code).toContain('attach(e, name = "rD2E")')
    expect(code).toContain('"get_cohort_definition_set"')
  })

  it('short-circuits rD2E in the library/require/:: shims', () => {
    // Each shim must delegate non-rD2E packages to the previous binding,
    // otherwise installing the shim would break library(dplyr).
    for (const prev of ['prevLib', 'prevReq', 'prevDcolon', 'prevTcolon']) {
      expect(code).toContain(prev)
    }
    expect(code).toContain('identical(nm, "rD2E")')
  })
})
