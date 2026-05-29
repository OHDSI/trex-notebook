import { test, expect } from '@playwright/test'
import { mockTrexAuth, seedSession } from './_auth'

const fixtureManifest = {
  version: '1.0',
  plugins: [
    {
      id: 'hello-fixture-plugin',
      name: 'Hello Fixture',
      version: '1.0.0',
      entryPoint: 'hello-fixture-plugin/index.system.js',
      menuItems: [
        { id: 'main', name: 'Hello Fixture', route: '/plugins/hello-fixture-plugin/', icon: 'mdi-hand-wave-outline' },
      ],
    },
  ],
}

test('host loads and mounts a plugin from the manifest', async ({ page }) => {
  await mockTrexAuth(page)
  await seedSession(page)
  await page.route('**/config/plugins.json', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureManifest) })
  )

  await page.goto('/plugins/hello-fixture-plugin/')

  await expect(page.getByTestId('nav-hello-fixture-plugin')).toBeVisible()
  await expect(page.getByTestId('fixture-root')).toBeVisible()
  await expect(page.getByTestId('fixture-root')).toContainText('Hello Fixture Plugin')
})
