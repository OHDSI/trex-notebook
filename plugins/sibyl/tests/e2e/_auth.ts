import type { Page } from '@playwright/test'

export const MOCK_USER = {
  id: 'u1',
  email: 'dev@trex.local',
  app_metadata: { trex_role: 'admin' },
  user_metadata: { name: 'Dev' },
}

// Intercept trex's auth endpoints so tests run without a live trex backend.
export async function mockTrexAuth(page: Page): Promise<void> {
  await page.route('**/trex/auth/v1/user', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route('**/trex/auth/v1/token**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'fake-jwt',
        refresh_token: 'fake-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
      }),
    })
  )
}

// Seed a non-expired session so the guard treats the page as authenticated.
export async function seedSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sibyl.auth.session',
      JSON.stringify({ access_token: 'fake-jwt', refresh_token: 'fake-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 })
    )
  })
}
