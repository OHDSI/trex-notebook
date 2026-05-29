import { test, expect } from '@playwright/test'
import { mockTrexAuth } from './_auth'

test('unauthenticated visit redirects to the login form', async ({ page }) => {
  await mockTrexAuth(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByTestId('login-card')).toBeVisible()
})

test('signing in lands on the shell', async ({ page }) => {
  await mockTrexAuth(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await page.getByTestId('login-email').locator('input').fill('dev@trex.local')
  await page.getByTestId('login-password').locator('input').fill('pw')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('brand')).toHaveText('SIBYL')
  await expect(page.getByTestId('no-plugins')).toBeVisible()
})
