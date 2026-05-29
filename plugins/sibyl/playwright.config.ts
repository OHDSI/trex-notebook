import { defineConfig, devices } from '@playwright/test'

const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
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
    command: 'npm run build:fixture && npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
