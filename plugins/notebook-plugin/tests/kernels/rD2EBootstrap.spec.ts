import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RD2EReadyWebRKernel } from '../../src/kernels/rD2EReadyWebRKernel'
import { buildRD2EBootstrapCode } from '../../src/kernels/rD2EBootstrap'
import type { KernelOutput } from '@trex/notebook'

async function collect(iter: AsyncIterable<KernelOutput>): Promise<KernelOutput[]> {
  const out: KernelOutput[] = []
  for await (const o of iter) out.push(o)
  return out
}

function errorsAndStderr(outputs: KernelOutput[]): KernelOutput[] {
  return outputs.filter(
    (o: any) => o.type === 'error' || (o.type === 'stream' && o.name === 'stderr')
  )
}

function stdout(outputs: KernelOutput[]): string {
  return outputs
    .filter((o: any) => o.type === 'stream' && o.name === 'stdout')
    .map((o: any) => o.text)
    .join('')
}

// These tests run the bootstrap against a real WebR session (no mocking) so
// they exercise the actual `library`/`require`/`::`/`:::` monkey-patches
// installed in the base environment — see the risk callout on
// rD2EBootstrap.ts's global bindings mutation.
describe('rD2E bootstrap — library/require/:: shims (real WebR)', () => {
  let kernel: RD2EReadyWebRKernel

  beforeAll(async () => {
    kernel = new RD2EReadyWebRKernel()
    await kernel.connect({ type: 'webr' } as any)
  }, 60000)

  afterAll(async () => {
    await kernel?.disconnect().catch(() => {})
  })

  async function run(code: string): Promise<{ outputs: KernelOutput[]; out: string }> {
    const outputs = await collect(kernel.execute(code, 'r'))
    return { outputs, out: stdout(outputs) }
  }

  it('library("rD2E") with a literal name succeeds without installing a real package', async () => {
    const { outputs } = await run(`library("rD2E")`)
    expect(errorsAndStderr(outputs)).toEqual([])
  })

  it('library(pkg, character.only = TRUE) resolves rD2E from a variable, not just a literal', async () => {
    const { outputs } = await run(`
pkg_name <- "rD2E"
library(pkg_name, character.only = TRUE)
cat("ok")
`)
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(stdout(outputs)).toContain('ok')
  })

  it('require("rD2E") with a literal name succeeds', async () => {
    const { outputs, out } = await run(`cat(require("rD2E"))`)
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(out).toBe('TRUE')
  })

  it('require(pkg, character.only = TRUE) resolves rD2E from a variable', async () => {
    const { outputs, out } = await run(`
pkg_name <- "rD2E"
cat(require(pkg_name, character.only = TRUE))
`)
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(out).toBe('TRUE')
  })

  it('library() on a normal base package still works unshimmed', async () => {
    const { outputs } = await run(`library(stats)`)
    expect(errorsAndStderr(outputs)).toEqual([])
  })

  it('library(pkg, character.only = TRUE) on a normal package still works unshimmed', async () => {
    const { outputs } = await run(`
pkg_name <- "stats"
library(pkg_name, character.only = TRUE)
cat("ok")
`)
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(stdout(outputs)).toContain('ok')
  })

  it(':: for a non-rD2E package still delegates to the original operator', async () => {
    const { outputs, out } = await run(`cat(stats::sd(c(1, 2, 3)))`)
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(out).toBe('1')
  })

  it(':::  for a non-rD2E package still delegates to the original operator', async () => {
    const { outputs, out } = await run(`cat(tools:::file_ext("report.R"))`)
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(out).toBe('R')
  })

  it('rD2E::create_options resolves the exported function', async () => {
    const { outputs, out } = await run(
      `cat(rD2E::create_options(source_token_study_code = "abc")$datasetId)`
    )
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(out).toBe('abc')
  })

  it('create_options omits analysisResultsName when not given or blank', async () => {
    const { outputs, out } = await run(
      `cat(is.null(rD2E::create_options()$analysisResultsName), is.null(rD2E::create_options(analysis_results_name = "   ")$analysisResultsName))`
    )
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(out).toBe('TRUE TRUE')
  })

  it('create_options trims and includes analysisResultsName', async () => {
    const { outputs, out } = await run(
      `cat(rD2E::create_options(analysis_results_name = "  My run ")$analysisResultsName)`
    )
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(out).toBe('My run')
  })

  it('create_options rejects an analysis_results_name over 255 characters', async () => {
    const { outputs } = await run(
      `rD2E::create_options(analysis_results_name = strrep("a", 256))`
    )
    expect(JSON.stringify(errorsAndStderr(outputs))).toContain('at most 255 characters')
  })

  it('create_options rejects an NA analysis_results_name', async () => {
    const { outputs } = await run(`rD2E::create_options(analysis_results_name = NA)`)
    expect(JSON.stringify(errorsAndStderr(outputs))).toContain('must be a single string')
  })

  it('create_options rejects a non-character analysis_results_name', async () => {
    const { outputs } = await run(`rD2E::create_options(analysis_results_name = 5)`)
    expect(JSON.stringify(errorsAndStderr(outputs))).toContain('must be a single string')
  })

  it('create_options trims Unicode whitespace from analysis_results_name', async () => {
    const { outputs, out } = await run(
      `cat(is.null(rD2E::create_options(analysis_results_name = "\\u00a0\\u00a0")$analysisResultsName))`
    )
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(out).toBe('TRUE')
  })

  it('create_options rejects control characters in analysis_results_name', async () => {
    const { outputs } = await run(`rD2E::create_options(analysis_results_name = "a\\nb")`)
    expect(JSON.stringify(errorsAndStderr(outputs))).toContain('must not contain control characters')
  })

  it("rD2E:::.rD2E_to_json resolves the internal (dot-prefixed) function", async () => {
    const { outputs, out } = await run(`cat(rD2E:::.rD2E_to_json(list(a = 1)))`)
    expect(errorsAndStderr(outputs)).toEqual([])
    expect(out).toContain('"a"')
  })
})

describe('rD2E bootstrap — interrupt and reconnect (real WebR)', () => {
  it('rD2E still resolves after interrupt(), once the interrupted eval slot is consumed', async () => {
    const kernel = new RD2EReadyWebRKernel()
    await kernel.connect({ type: 'webr' } as any)
    try {
      await kernel.interrupt()
      // WebR's interrupt() only takes effect on the next evaluation (there is
      // no in-flight eval to cancel here), so the first post-interrupt
      // execute() absorbs an "UnwindProtectException" from webR itself —
      // reproducible with the plain (non-rD2E) WebRKernel too, so it is not
      // an rD2E bootstrap defect. What matters for the bootstrap is that
      // rD2E survives the interrupt and resolves again right after.
      await collect(kernel.execute('1+1', 'r'))

      const outputs = await collect(
        kernel.execute(`cat(rD2E::create_options(source_token_study_code = "x")$datasetId)`, 'r')
      )
      expect(errorsAndStderr(outputs)).toEqual([])
      expect(stdout(outputs)).toBe('x')
    } finally {
      await kernel.disconnect().catch(() => {})
    }
  }, 60000)

  it('rD2E is re-bootstrapped after a full disconnect/reconnect cycle', async () => {
    const kernel = new RD2EReadyWebRKernel()
    await kernel.connect({ type: 'webr' } as any)
    try {
      await kernel.disconnect()
      await kernel.connect({ type: 'webr' } as any)
      const outputs = await collect(
        kernel.execute(`cat(rD2E::create_options(source_token_study_code = "y")$datasetId)`, 'r')
      )
      expect(errorsAndStderr(outputs)).toEqual([])
      expect(stdout(outputs)).toBe('y')
    } finally {
      await kernel.disconnect().catch(() => {})
    }
  }, 60000)
})

describe('rD2E bootstrap — multiple cells and repeated bootstrap attempts (real WebR)', () => {
  it('rD2E state persists across separate execute() calls (separate notebook cells)', async () => {
    const kernel = new RD2EReadyWebRKernel()
    await kernel.connect({ type: 'webr' } as any)
    try {
      const cell1 = await collect(kernel.execute(`assign("cellValue", 42, envir = .GlobalEnv)`, 'r'))
      expect(errorsAndStderr(cell1)).toEqual([])

      const cell2 = await collect(
        kernel.execute(`cat(cellValue, rD2E::create_options(source_token_study_code = "z")$datasetId)`, 'r')
      )
      expect(errorsAndStderr(cell2)).toEqual([])
      expect(stdout(cell2)).toBe('42 z')
    } finally {
      await kernel.disconnect().catch(() => {})
    }
  }, 60000)

  it('re-running the bootstrap code in the same session does not break library/::/rD2E behavior', async () => {
    const kernel = new RD2EReadyWebRKernel()
    await kernel.connect({ type: 'webr' } as any)
    try {
      // Simulates a second bootstrap attempt landing in an already-bootstrapped
      // session (e.g. a race between two connect() calls).
      const rerun = await collect(kernel.execute(buildRD2EBootstrapCode(), 'r'))
      expect(errorsAndStderr(rerun)).toEqual([])

      const afterRerun = await collect(
        kernel.execute(
          `cat(rD2E::create_options(source_token_study_code = "w")$datasetId, stats::sd(c(1, 2, 3)))`,
          'r'
        )
      )
      expect(errorsAndStderr(afterRerun)).toEqual([])
      expect(stdout(afterRerun)).toBe('w 1')
    } finally {
      await kernel.disconnect().catch(() => {})
    }
  }, 60000)
})
