import { test, expect } from '@playwright/test'
import { mockTrexAuth, seedSession } from './_auth'

test('authenticated shell shows the empty no-plugins state', async ({ page }) => {
  await mockTrexAuth(page)
  await seedSession(page)
  await page.goto('/')
  await expect(page.getByTestId('brand')).toHaveText('SIBYL')
  await expect(page.getByTestId('no-plugins')).toBeVisible()
  await expect(page.getByTestId('nav-empty')).toBeVisible()
})
