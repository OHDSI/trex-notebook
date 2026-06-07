import { test, expect } from '@playwright/test'
import { mockTrexAuth, seedSession } from './_auth'

// Register the jobs plugin in the manifest so we can prove it is rendered as a
// header ICON (nav-jobs) and NOT as a text nav link (nav-jobs-plugin). Its parcel
// entry isn't served in e2e, so opening the Jobs drawer surfaces a mount error —
// that's fine here; we only assert the drawer itself opens.
const jobsManifest = {
  version: '1.0',
  plugins: [
    {
      id: 'jobs-plugin',
      name: 'Jobs',
      version: '1.0.0',
      entryPoint: 'jobs-plugin/index.system.js',
      menuItems: [
        { id: 'main', name: 'Jobs', route: '/plugins/jobs-plugin/', icon: 'mdi-clipboard-list-outline', order: 55 },
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(jobsManifest) })
    )
    await page.goto('/')
  })

  test('settings icon opens the settings drawer with both sections', async ({ page }) => {
    await page.getByTestId('nav-settings').click()
    await expect(page.getByTestId('settings-panel')).toHaveClass(ACTIVE)
    await expect(page.getByRole('tab', { name: 'R Environments' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'WebAPI' })).toBeVisible()

    await page.getByRole('tab', { name: 'WebAPI' }).click()
    await expect(page.getByTestId('webapi-url')).toBeVisible()

    await page.getByTestId('settings-close').click()
    await expect(page.getByTestId('settings-panel')).not.toHaveClass(ACTIVE)
  })

  test('jobs is a header icon (not a text link) and opens the jobs drawer', async ({ page }) => {
    // Jobs is filtered out of the text nav...
    await expect(page.getByTestId('nav-jobs-plugin')).toHaveCount(0)
    // ...and present as an icon button that opens the drawer.
    await expect(page.getByTestId('nav-jobs')).toBeVisible()
    await page.getByTestId('nav-jobs').click()
    await expect(page.getByTestId('jobs-panel')).toHaveClass(ACTIVE)
  })
})
