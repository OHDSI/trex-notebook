import { defineConfig, devices } from '@playwright/test'

// results-viewer is a single-spa parcel — it cannot host itself. These e2e
// tests run it inside the sibyl host shell: the webServer below first builds
// this plugin (output lands in ../sibyl/public/plugins/results-viewer) and then
// starts sibyl's dev server, which serves the bundle and sends the COOP/COEP
// headers WebR/DuckDB need.
//
// The ZIP-upload tests additionally require test-data/test-results.zip (built by
// scripts/generate-test-data.R) and the shinylive bundle + r-packages (built by
// scripts/build-shinylive-export.R). Without those, only the mount/loader tests
// pass; the WebR-dependent tests stay on the loading state.

const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:5174',
    testIdAttribute: 'data-test',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // In CI, PLAYWRIGHT_CHROMIUM_PATH is unset and Playwright uses its managed
    // browser. Locally (where `playwright install` is unavailable) set it to a
    // system/cached Chromium; --no-sandbox is required for that case.
    launchOptions: chromiumPath
      ? { executablePath: chromiumPath, args: ['--no-sandbox'] }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Build this plugin into sibyl's public dir, then serve via sibyl's dev server.
    command: 'npm run build && npm --prefix ../sibyl run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
})
