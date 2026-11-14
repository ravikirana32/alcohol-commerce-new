import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER ? undefined : [
    { command: 'npm run dev:api', url: 'http://localhost:8080/api/health/live', reuseExistingServer: !process.env.CI, timeout: 120000 },
    { command: 'npm run dev:web', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 120000 }
  ]
});
