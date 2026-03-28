/**
 * Playwright configuration for performance benchmarks.
 *
 * Runs browser-based performance measurements that cannot be tested
 * in a Node.js environment: input latency, page load (LCP), note open
 * time, and WebSocket round-trip.
 *
 * These tests produce JSON results in `reports/benchmarks/` for CI
 * regression tracking.
 *
 * Usage:
 *   pnpm exec playwright test --config=apps/web/playwright/benchmark.config.ts
 *
 * @module playwright/benchmark.config
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: '../src/__tests__/benchmarks',
  testMatch: '**/*.bench.ts',

  /* Benchmarks may need longer to complete */
  timeout: 120_000,

  expect: {
    timeout: 15_000,
  },

  /* Run sequentially to avoid resource contention affecting timing */
  fullyParallel: false,
  workers: 1,

  /* Reporter configuration */
  reporter: [
    ['json', { outputFile: '../../../reports/benchmarks/playwright-benchmarks.json' }],
    ['list'],
  ],

  /* No retries for benchmarks — retries would skew timing data */
  retries: 0,

  use: {
    baseURL: BASE_URL,
    /* No traces for benchmarks — traces add overhead */
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'Benchmark - Desktop Chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        /* Disable animations and transitions for consistent timing */
        launchOptions: {
          args: [
            '--disable-animations',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },
  ],

  webServer: {
    command: 'pnpm nx serve web',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
