import { test, expect } from '@playwright/test'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { mockTrexAuth, seedSession } from './_auth'
import { waitForDashboardFrame } from './_frame'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const screenshotDir = path.resolve(__dirname, '../../test-results/results-viewer-tabs')
const testZipPath = path.resolve(__dirname, '../../test-data/test-results-full.zip')
const hasTestZip = existsSync(testZipPath)

test.describe('Results Viewer - Each Tab', () => {
  test.setTimeout(240000)

  test('screenshot each result viewer tab', async ({ page }) => {
    test.skip(!hasTestZip, 'requires test-data/test-results-full.zip + shinylive bundle from the R build')
    await mockTrexAuth(page)
    await seedSession(page)
    await page.goto('/plugins/results-viewer/')
    await page.waitForTimeout(3000)

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 20000 })
    await fileInput.setInputFiles(testZipPath)

    // The OHDSI viewer renders inside shinylive's nested iframe.
    const frame = await waitForDashboardFrame(page)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${screenshotDir}/01-cohort-counts.png`, fullPage: true })

    // Best-effort: click each tab if present and screenshot. Tab clicks re-render
    // the inner shiny frame, so each action is hard-bounded and non-fatal — the
    // meaningful assertion (dashboard rendered) already passed above.
    for (const [i, label] of ['Incidence Rates', 'Inclusion Rules', 'Cohort Definitions', 'Data Sources'].entries()) {
      try {
        const tab = frame.getByText(label, { exact: false }).first()
        if ((await tab.count()) > 0) {
          await tab.click({ timeout: 5000 })
          await page.waitForTimeout(500)
          await page.screenshot({ path: `${screenshotDir}/0${i + 2}-${label.replace(/\s+/g, '-').toLowerCase()}.png`, fullPage: true })
        }
      } catch { /* tab missing or frame re-rendered — skip */ }
    }
  })
})
