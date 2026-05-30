import { test, expect } from '@playwright/test'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { mockTrexAuth, seedSession } from './_auth'
import { waitForDashboardFrame } from './_frame'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The full upload → WebR → Shiny flow needs test-data/test-results-full.zip (built by
// scripts/generate-test-data.R) and the shinylive bundle + r-packages (built by
// scripts/build-shinylive-export.R). When those artifacts are absent the
// upload-driven tests are skipped, so the suite still verifies that the plugin
// mounts inside sibyl and renders its library.
const testZipPath = path.resolve(__dirname, '../../test-data/test-results-full.zip')
const hasTestZip = existsSync(testZipPath)

test.describe('Results Viewer Plugin', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrexAuth(page)
    await seedSession(page)
  })

  test('plugin route loads and shows the results library', async ({ page }) => {
    await page.goto('/plugins/results-viewer/')
    // single-spa needs a moment to import + mount the parcel
    await expect(page.getByRole('heading', { name: 'Analysis Results' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('button', { name: 'Import Result' }).first()).toBeVisible()
  })

  test('registered in sibyl sidebar navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Results' })).toBeVisible({ timeout: 20000 })
  })

  test('rejects a non-ZIP file with an error', async ({ page }) => {
    await page.goto('/plugins/results-viewer/')
    await expect(page.getByRole('heading', { name: 'Analysis Results' })).toBeVisible({ timeout: 20000 })

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 20000 })
    await fileInput.setInputFiles({
      name: 'bad-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a zip'),
    })

    // The library surfaces import/open failures in a Vuetify error alert.
    await expect(page.locator('.rv-alert').filter({ hasText: /could not/i })).toBeVisible({ timeout: 15000 })
  })

  test('accepts a ZIP upload and transitions to the viewer', async ({ page }) => {
    test.skip(!hasTestZip, 'requires test-data/test-results-full.zip from generate-test-data.R')
    await page.goto('/plugins/results-viewer/')
    await expect(page.getByRole('heading', { name: 'Analysis Results' })).toBeVisible({ timeout: 20000 })

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 20000 })
    await fileInput.setInputFiles(testZipPath)

    // After import the app switches to the viewer phase, which mounts ShinyFrame
    // and shows its loading overlay while WebR warms up.
    await expect(page.locator('.rv-loading-overlay, .rv-loading')).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Results Viewer - WebR Bootstrap', () => {
  test.setTimeout(180000) // 3 minutes — WebR download + init is slow

  test.beforeEach(async ({ page }) => {
    await mockTrexAuth(page)
    await seedSession(page)
  })

  test('ZIP upload boots WebR and renders the OHDSI dashboard', async ({ page }) => {
    test.skip(!hasTestZip, 'requires test-data/test-results-full.zip + shinylive bundle from the R build')
    await page.goto('/plugins/results-viewer/')
    await expect(page.getByRole('heading', { name: 'Analysis Results' })).toBeVisible({ timeout: 20000 })

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 20000 })
    await fileInput.setInputFiles(testZipPath)

    // The ShinyFrame loading overlay shows while the R engine warms up.
    await expect(page.locator('.rv-loading-overlay')).toBeVisible({ timeout: 30000 })

    // The OHDSI HADES viewer renders inside shinylive's nested iframe — confirm
    // its tabs (Cohort Counts / Data Sources / …) appear.
    const frame = await waitForDashboardFrame(page)
    await expect.poll(
      () => frame.evaluate(() => document.body?.innerText || '').catch(() => ''),
      { timeout: 60000 }
    ).toMatch(/cohort count|data source/i)
    await page.screenshot({ path: 'test-results/results-viewer-dashboard.png', fullPage: true })
  })
})
