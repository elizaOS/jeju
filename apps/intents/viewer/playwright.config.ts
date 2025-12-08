/**
 * @fileoverview Playwright configuration for OIF Viewer E2E tests
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Synpress doesn't support parallel wallet tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for wallet tests
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  
  use: {
    baseURL: process.env.VIEWER_URL || 'http://localhost:4011',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start viewer dev server before tests
  webServer: [
    {
      command: 'bun run dev',
      cwd: '..',
      port: 4010,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'bun run dev',
      port: 4011,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],

  // Timeout settings
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});

