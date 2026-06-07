import { test, expect } from '@playwright/test'
import { mockTrexAuth, seedSession } from './_auth'

// Register TWO plugins: the served fixture (proves a normal plugin DOES appear as
// a text nav link) and jobs-plugin (which must NOT appear as text — it's promoted
// to a header icon). Contrasting the two proves Jobs is *filtered*, not merely
// absent because its parcel failed to load. The exhaustive filter logic itself is
// unit-tested in tests/navmenu-filter.spec.ts; here we verify the shell wiring.
// jobs-plugin's parcel entry isn't served in e2e, so opening the Jobs drawer may
// surface a mount error — that's fine; we only assert the drawer opens/closes.
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

  test('jobs is a header icon (not a text link) and opens the jobs drawer', async ({ page }) => {
    // A normal registered plugin DOES show as a text nav link...
    await expect(page.getByTestId('nav-hello-fixture-plugin')).toBeVisible()
    // ...but Jobs is filtered out of the text nav (no nav-jobs-plugin link)...
    await expect(page.getByTestId('nav-jobs-plugin')).toHaveCount(0)
    // ...and instead is a header icon button that opens the drawer.
    await expect(page.getByTestId('nav-jobs')).toBeVisible()
    await page.getByTestId('nav-jobs').click()
    await expect(page.getByTestId('jobs-panel')).toHaveClass(ACTIVE)

    await page.getByTestId('jobs-close').click()
    await expect(page.getByTestId('jobs-panel')).not.toHaveClass(ACTIVE)
  })
})
