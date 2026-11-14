import { test, expect } from '@playwright/test';

test('POS web application loads', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('body')).not.toBeEmpty();
});

test('API liveness is available', async ({ request }) => {
  const base = process.env.API_BASE_URL || 'http://localhost:8080';
  const response = await request.get(`${base}/api/health/live`);
  expect(response.ok()).toBeTruthy();
});
