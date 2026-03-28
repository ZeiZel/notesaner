/**
 * Lighthouse CI Configuration
 *
 * Root-level config for @lhci/cli autorun.
 * Enforces performance score > 90 and Core Web Vitals budgets.
 *
 * Usage:
 *   npx @lhci/cli autorun
 *   npx @lhci/cli autorun --config=.lighthouserc.js
 *
 * Install:
 *   pnpm add -Dw @lhci/cli
 *
 * @see apps/web/src/__tests__/performance/lighthouse.config.ts for detailed budget definitions
 */

const BASE_URL = process.env.LHCI_BASE_URL || 'http://localhost:3000';

module.exports = {
  ci: {
    collect: {
      url: [`${BASE_URL}/`],
      numberOfRuns: 3,
      startServerCommand: 'pnpm nx serve web',
      startServerReadyPattern: 'ready started server',
      startServerReadyTimeout: 60000,
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu',
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance score > 90
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],

        // Core Web Vitals
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // Additional metrics
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],
        interactive: ['error', { maxNumericValue: 3500 }],

        // Resource budgets
        'total-byte-weight': ['error', { maxNumericValue: 1000000 }],

        // Disable noisy rules for early development
        'unsized-images': 'off',
        'uses-responsive-images': 'off',
        'unused-javascript': 'off',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: 'reports/lighthouse',
    },
  },
};
