import { test, expect } from '@playwright/test';

test('plugin mounts and shows the login gate when unauthenticated', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Sign in with Cognito')).toBeVisible();
});
