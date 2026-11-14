import { test, expect } from '@playwright/test';

const api = process.env.API_BASE_URL || 'http://localhost:8080';

test.describe('P542 API platform acceptance', () => {
  test('liveness returns a stable service contract and request correlation id', async ({ request }) => {
    const response = await request.get(`${api}/api/health/live`, { headers: { 'x-request-id': 'p542-live-check-01' } });
    expect(response.status()).toBe(200);
    expect(response.headers()['x-request-id']).toBe('p542-live-check-01');
    await expect(response.json()).resolves.toMatchObject({ status: 'live', service: 'api' });
  });

  test('metadata exposes version and explicit feature flags', async ({ request }) => {
    const response = await request.get(`${api}/api/meta`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('Alcohol Commerce Platform API');
    expect(body.version).toMatch(/^0\.\d+\.0-dev$/);
    expect(body.featureFlags).toEqual(expect.objectContaining({
      ai: expect.any(Boolean), offlineSync: expect.any(Boolean),
      consumerDiscovery: expect.any(Boolean), livePayments: expect.any(Boolean)
    }));
  });

  test('security headers are present on API responses', async ({ request }) => {
    const response = await request.get(`${api}/api/health/live`);
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-frame-options']).toBeTruthy();
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });

  test('unknown API paths return a structured not-found response', async ({ request }) => {
    const response = await request.get(`${api}/api/p542/route-that-does-not-exist`);
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.requestId).toBeTruthy();
  });

  test('malformed JSON is rejected with a structured client error', async ({ request }) => {
    const response = await request.post(`${api}/api/v1/auth/login`, {
      headers: { 'content-type': 'application/json', 'x-request-id': 'p542-invalid-json-01' },
      data: '{not-json'
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_JSON');
    expect(body.requestId).toBe('p542-invalid-json-01');
  });

  test('readiness reports database dependency explicitly', async ({ request }) => {
    const response = await request.get(`${api}/api/health/ready`);
    const body = await response.json();
    expect([200, 503]).toContain(response.status());
    expect(body.checks).toEqual(expect.objectContaining({ http: expect.any(String), database: expect.any(String) }));
    if (response.status() === 200) expect(body.checks.database).toBe('ok');
    else expect(body.status).toBe('not-ready');
  });
});

test.describe('P542 browser acceptance', () => {
  test('unauthenticated user is shown the secure login screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveAttribute('type', 'email');
    await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText(/No live transactions enabled/)).toBeVisible();
  });

  test('login form validates required fields before submission', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('Email address')).toBeFocused();
  });
});
