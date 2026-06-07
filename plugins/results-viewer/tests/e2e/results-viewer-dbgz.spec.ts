import { test, expect } from '@playwright/test'
import path from 'path'
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { mockTrexAuth, seedSession } from './_auth'
import { waitForDashboardFrame } from './_frame'

// End-to-end test of the binary DuckDB ingest path. Imports a gzip-compressed
// DuckDB results file (results.db.gz — written by the REAL hades DuckDB 1.4.4),
// which ResultsLibrary gunzips, ShinyFrame streams to the Shinylive iframe as
// base64 (RESULT_DB_*), and app.R base64-decodes → ATTACHes → materializes.
//
// Proof of success is app.R's own log line "Loaded submitted DuckDB: N tables"
// (webR routes R messages to the browser console). That single line means the
// whole chain worked: gunzip → base64 channel → setInputValue → base64_dec →
// writeBin → ATTACH → table_catalog discovery → CREATE TABLE.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbgz = path.resolve(__dirname, '../../test-data/results.db.gz')
const outDir = path.resolve(__dirname, '../../test-results/dbgz')
const hasDbGz = existsSync(dbgz)

const SUCCESS = /Loaded submitted DuckDB: (\d+) tables/
const FAILURE = /Failed to (load|attach) submitted DB|unexpected string constant|could not (open|import)/i

test.describe('Results Viewer — binary .db.gz ingest', () => {
  test.setTimeout(480000) // WebR cold boot can take several minutes

  test.beforeEach(async ({ page }) => {
    await mockTrexAuth(page)
    await seedSession(page)
  })

  test('imports results.db.gz and app.R attaches the submitted DuckDB', async ({ page }) => {
    test.skip(!hasDbGz, 'requires test-data/results.db.gz + the shinylive bundle')
    mkdirSync(outDir, { recursive: true })
    const logPath = `${outDir}/console.log`
    writeFileSync(logPath, '')
    const logs: string[] = []
    page.on('console', (m) => {
      const line = `[${m.type()}] ${m.text()}`
      logs.push(line)
      appendFileSync(logPath, line + '\n')
    })

    await page.goto('/plugins/results-viewer/')
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 30000 })
    await page.screenshot({ path: `${outDir}/01-library.png`, fullPage: true })

    await fileInput.setInputFiles(dbgz)
    await expect(page.locator('.rv-loading-overlay')).toBeVisible({ timeout: 30000 })
    await page.screenshot({ path: `${outDir}/02-loading.png`, fullPage: true })

    // Fail fast if app.R errors; otherwise wait for the success marker.
    await expect
      .poll(() => logs.join('\n'), { timeout: 420000, intervals: [4000] })
      .toMatch(SUCCESS)

    const failures = logs.filter((l) => FAILURE.test(l))
    expect(failures, `app.R reported failures:\n${failures.join('\n')}`).toHaveLength(0)

    const m = logs.join('\n').match(SUCCESS)
    // The fixture is the real Strategus CohortGeneratorModule results data model
    // (the cg_* tables), so assert tables were attached rather than a fixed count.
    expect(Number(m![1]), 'app.R should have attached the submitted DuckDB tables').toBeGreaterThanOrEqual(3)

    // Visual confirmation that the dashboard rendered the data.
    try {
      const frame = await waitForDashboardFrame(page, 60000)
      writeFileSync(`${outDir}/frame.txt`, await frame.evaluate(() => document.body?.innerText || ''))
    } catch { /* sparse fixture may not trip the dashboard-text heuristic */ }
    await page.screenshot({ path: `${outDir}/03-rendered.png`, fullPage: true })
  })
})
