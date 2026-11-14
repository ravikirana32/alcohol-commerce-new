import { expect, test } from '@playwright/test';

const profile = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'platform.admin@demo.acp.local',
  displayName: 'Demo Platform Admin',
  isPlatformAdmin: true,
  organisationId: null,
  roleCode: null,
  sessionId: '00000000-0000-4000-8000-000000000002',
  permissions: ['platform:manage']
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/health/live', (route) =>
    route.fulfill({ json: { status: 'live', service: 'api' } })
  );
});

test('shows login validation and reports invalid credentials', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } }
    })
  );

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email address').fill('platform.admin@demo.acp.local');
  await page.getByLabel('Password').fill('invalid-local-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Email or password is incorrect')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('stores a successful login session and loads the authenticated workspace', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      json: {
        data: {
          accessToken: 'frontend-test-token',
          tokenType: 'Bearer',
          user: {
            userId: profile.userId,
            email: profile.email,
            displayName: profile.displayName,
            isPlatformAdmin: profile.isPlatformAdmin,
            organisationId: profile.organisationId,
            roleCode: profile.roleCode
          }
        }
      }
    })
  );
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { data: profile } })
  );

  await page.goto('/');
  await page.getByLabel('Email address').fill(profile.email);
  await page.getByLabel('Password').fill('local-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
  await expect(page.locator('.workspace-switch')).toContainText('Platform workspace');
  await expect(page.getByText('Authenticated')).toBeVisible();
});
