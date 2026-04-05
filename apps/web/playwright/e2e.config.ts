/**
 * Playwright configuration for end-to-end (e2e) functional tests.
 *
 * Comprehensive E2E suite covering auth, notes CRUD, editor, collaboration,
 * plugins, graph, backlinks, settings, layout, and navigation flows.
 *
 * Usage:
 *   npx playwright test --config=apps/web/playwright/e2e.config.ts
 *
 * @module playwright/e2e.config
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  /* Timeout per test — 30 seconds */
  timeout: 30_000,

  /* Assertion timeout */
  expect: {
    timeout: 10_000,
  },

  /* Run tests in parallel for speed */
  fullyParallel: true,

  /* Reporter configuration */
  reporter: [['html', { outputFolder: '../../../reports/e2e-html', open: 'never' }], ['list']],

  /* Retry on CI to reduce flakiness */
  retries: process.env.CI ? 2 : 0,

  /* Shared settings for all projects */
  use: {
    baseURL: BASE_URL,
    /* Collect traces on first retry for debugging */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Default viewport */
    viewport: { width: 1280, height: 720 },
    /* Action timeout */
    actionTimeout: 10_000,
  },

  /* Chromium only for speed */
  projects: [
    {
      name: 'Desktop Chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  /* Auto-start the Next.js dev server (skip in CI — pre-built) */
  ...(!process.env.CI && {
    webServer: {
      command: 'pnpm nx serve web',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  }),
});
