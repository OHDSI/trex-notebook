import { test, expect } from '@playwright/test'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { mockTrexAuth, seedSession } from './_auth'
import { waitForDashboardFrame } from './_frame'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const screenshotDir = path.resolve(__dirname, '../../test-results/results-viewer-screenshots')
const testZipPath = path.resolve(__dirname, '../../test-data/test-results-full.zip')
const hasTestZip = existsSync(testZipPath)

test.describe('Results Viewer - Full Flow Screenshots', () => {
  test.setTimeout(300000) // WebR needs time to download + install

  test.beforeEach(async ({ page }) => {
    await mockTrexAuth(page)
    await seedSession(page)
  })

  test('capture each stage of the results viewer', async ({ page }) => {
    test.skip(!hasTestZip, 'requires test-data/test-results-full.zip + shinylive bundle from the R build')
    await page.goto('/plugins/results-viewer/')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${screenshotDir}/01-library.png`, fullPage: true })

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 20000 })
    await fileInput.setInputFiles(testZipPath)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${screenshotDir}/02-loading.png`, fullPage: true })

    // Wait for the OHDSI dashboard to render inside shinylive's nested iframe.
    await waitForDashboardFrame(page)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${screenshotDir}/03-dashboard.png`, fullPage: true })
  })
})
