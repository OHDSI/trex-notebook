import { test, expect } from '@playwright/test'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { mockTrexAuth, seedSession } from './_auth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const testZipPath = path.resolve(__dirname, '../../test-data/test-results-full.zip')
const hasTestZip = existsSync(testZipPath)

test.describe('Results Viewer Debug', () => {
  test.setTimeout(180000)

  test('capture all console output during load', async ({ page }) => {
    test.skip(!hasTestZip, 'requires test-data/test-results-full.zip + shinylive bundle from the R build')
    await mockTrexAuth(page)
    await seedSession(page)

    const logs: string[] = []
    page.on('console', msg => {
      logs.push(`[${msg.type()}] ${msg.text()}`)
    })
    page.on('pageerror', err => {
      logs.push(`[PAGE ERROR] ${err.message}`)
    })

    await page.goto('/plugins/results-viewer/')
    await page.waitForTimeout(3000)

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 20000 })

    await fileInput.setInputFiles(testZipPath)

    // Wait 90 seconds for the full flow
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(15000)
      await page.screenshot({
        path: `test-results/results-viewer-debug-${i * 15 + 15}s.png`,
        fullPage: true
      })
    }

    // Dump all console logs
    console.log('=== BROWSER CONSOLE LOGS ===')
    for (const log of logs) {
      console.log(log)
    }
    console.log(`=== END (${logs.length} messages) ===`)
  })
})
