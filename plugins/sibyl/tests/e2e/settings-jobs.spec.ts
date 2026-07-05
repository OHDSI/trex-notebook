import { test, expect } from '@playwright/test'
import { mockTrexAuth, seedSession } from './_auth'

// Register the served fixture to prove a normal plugin appears as a text nav link.
const manifest = {
  version: '1.0',
  plugins: [
    {
      id: 'hello-fixture-plugin',
      name: 'Hello Fixture',
      version: '1.0.0',
      entryPoint: 'hello-fixture-plugin/index.system.js',
      menuItems: [
        { id: 'main', name: 'Hello Fixture', route: '/plugins/hello-fixture-plugin/', icon: 'mdi-hand-wave-outline', order: 10 },
      ],
    },
  ],
}

const ACTIVE = /v-navigation-drawer--active/

test.describe('header sidepanels', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrexAuth(page)
    await seedSession(page)
    await page.route('**/config/plugins.json', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manifest) })
    )
    await page.goto('/')
  })

  test('settings icon opens the settings drawer with both sections', async ({ page }) => {
    await page.getByTestId('nav-settings').click()
    await expect(page.getByTestId('settings-panel')).toHaveClass(ACTIVE)
    await expect(page.getByText('Settings', { exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'R Environments' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'WebAPI' })).toBeVisible()

    await page.getByRole('tab', { name: 'WebAPI' }).click()
    await expect(page.getByTestId('webapi-url')).toBeVisible()

    await expect(page.getByRole('tab', { name: 'Network' })).toBeVisible()

    await page.getByTestId('settings-close').click()
    await expect(page.getByTestId('settings-panel')).not.toHaveClass(ACTIVE)
  })
})
