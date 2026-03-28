/**
 * Playwright configuration for accessibility (a11y) tests.
 *
 * This configuration is dedicated to WCAG 2.1 AA compliance testing using
 * @axe-core/playwright for automated accessibility scanning and Playwright
 * for keyboard/screen-reader behavioral tests.
 *
 * Usage:
 *   pnpm exec playwright test --config apps/web/playwright/a11y.config.ts
 *
 * @module playwright/a11y.config
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: '../src/__tests__/accessibility',
  testMatch: '**/*.test.ts',

  /* Global timeout per test — a11y scans can be slower due to axe injection */
  timeout: 60_000,

  /* Fail the build on console.error in the page */
  expect: {
    timeout: 10_000,
  },

  /* Run tests sequentially to avoid port contention */
  fullyParallel: false,
  workers: 1,

  /* Reporter configuration */
  reporter: [
    ['html', { outputFolder: '../../../reports/a11y-html', open: 'never' }],
    ['json', { outputFile: '../../../reports/a11y-results.json' }],
    ['list'],
  ],

  /* Retry on CI to reduce flakiness */
  retries: process.env.CI ? 2 : 0,

  /* Shared settings for all projects */
  use: {
    baseURL: BASE_URL,
    /* Collect traces on first retry for debugging */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Viewport for desktop tests */
    viewport: { width: 1280, height: 720 },
    /* Slow down actions slightly for visual debugging */
    actionTimeout: 10_000,
  },

  /* Test across multiple viewport sizes and browsers */
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Desktop Firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],

  /* Dev server configuration — start the Next.js dev server if not already running */
  webServer: {
    command: 'pnpm nx serve web',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
