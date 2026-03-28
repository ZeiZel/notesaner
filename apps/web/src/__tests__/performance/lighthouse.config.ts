/**
 * Lighthouse CI Configuration
 *
 * Defines performance budgets and Lighthouse CI settings for Notesaner.
 * Used by the CI pipeline to enforce Core Web Vitals and resource budgets.
 *
 * Performance budgets:
 *   - LCP:  < 2.5s  (Largest Contentful Paint)
 *   - FID:  < 100ms (First Input Delay) / TBT < 200ms as proxy
 *   - CLS:  < 0.1   (Cumulative Layout Shift)
 *   - FCP:  < 1.5s  (First Contentful Paint)
 *   - TTI:  < 3.5s  (Time to Interactive)
 *   - SI:   < 3.0s  (Speed Index)
 *
 * Resource budgets:
 *   - Total JS:   < 300KB (compressed)
 *   - Total CSS:  < 50KB  (compressed)
 *   - Total:      < 1MB   (all resources)
 *   - Fonts:      < 100KB
 *   - Images:     < 500KB
 *
 * Usage:
 *   npx @lhci/cli autorun --config=apps/web/src/__tests__/performance/lighthouse.config.ts
 *
 * Or via the benchmark runner:
 *   npx tsx scripts/benchmark.ts --suite=lighthouse
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LighthouseTimingBudget {
  metric: string;
  budget: number;
}

interface LighthouseResourceBudget {
  resourceType: string;
  budget: number;
}

interface LighthouseResourceCountBudget {
  resourceType: string;
  budget: number;
}

interface LighthouseBudget {
  timings: LighthouseTimingBudget[];
  resourceSizes: LighthouseResourceBudget[];
  resourceCounts: LighthouseResourceCountBudget[];
}

interface LighthouseCIConfig {
  ci: {
    collect: {
      url: string[];
      numberOfRuns: number;
      settings: {
        chromeFlags: string;
        onlyCategories: string[];
        preset: string;
        throttling: {
          rttMs: number;
          throughputKbps: number;
          cpuSlowdownMultiplier: number;
        };
      };
    };
    assert: {
      preset: string;
      assertions: Record<
        string,
        [string, { minScore?: number; maxNumericValue?: number; maxLength?: number }]
      >;
    };
    upload: {
      target: string;
      outputDir: string;
    };
  };
  budgets: LighthouseBudget[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.LHCI_BASE_URL ?? 'http://localhost:3000';

export const lighthouseConfig: LighthouseCIConfig = {
  ci: {
    collect: {
      url: [
        // Critical user journeys
        `${BASE_URL}/`, // Landing / dashboard
        `${BASE_URL}/workspace/demo/notes`, // Note list
        `${BASE_URL}/workspace/demo/note/sample`, // Editor view
        `${BASE_URL}/workspace/demo/search`, // Search page
        `${BASE_URL}/workspace/demo/graph`, // Graph view
      ],
      numberOfRuns: 3, // Median of 3 runs for stability
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu',
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
        preset: 'desktop',
        throttling: {
          // Simulate a typical broadband connection
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Core Web Vitals
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // Additional metrics
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],
        interactive: ['error', { maxNumericValue: 3500 }],

        // Scores
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],

        // Resource hints
        'uses-rel-preconnect': ['warn', { maxLength: 0 }],
        'uses-rel-preload': ['warn', { maxLength: 0 }],

        // Images
        'uses-webp-images': ['warn', { maxLength: 0 }],
        'offscreen-images': ['warn', { maxLength: 0 }],

        // JavaScript
        'unused-javascript': ['warn', { maxNumericValue: 50000 }],
        'total-byte-weight': ['error', { maxNumericValue: 1_000_000 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
  budgets: [
    {
      timings: [
        { metric: 'first-contentful-paint', budget: 1500 },
        { metric: 'largest-contentful-paint', budget: 2500 },
        { metric: 'total-blocking-time', budget: 200 },
        { metric: 'cumulative-layout-shift', budget: 0.1 },
        { metric: 'interactive', budget: 3500 },
        { metric: 'speed-index', budget: 3000 },
      ],
      resourceSizes: [
        { resourceType: 'script', budget: 300 }, // KB
        { resourceType: 'stylesheet', budget: 50 }, // KB
        { resourceType: 'image', budget: 500 }, // KB
        { resourceType: 'font', budget: 100 }, // KB
        { resourceType: 'total', budget: 1000 }, // KB
      ],
      resourceCounts: [
        { resourceType: 'script', budget: 15 },
        { resourceType: 'stylesheet', budget: 5 },
        { resourceType: 'image', budget: 20 },
        { resourceType: 'font', budget: 4 },
        { resourceType: 'third-party', budget: 5 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Export for programmatic use
// ---------------------------------------------------------------------------

/**
 * Returns the Lighthouse budget configuration as a JSON object
 * suitable for the `--budget-path` flag.
 */
export function getLighthouseBudgetJson(): LighthouseBudget[] {
  return lighthouseConfig.budgets;
}

/**
 * Returns the LHCI configuration for `lhci autorun`.
 * Can be written to `lighthouserc.json` or used programmatically.
 */
export function getLhciConfig() {
  return lighthouseConfig.ci;
}

/**
 * Returns performance budget thresholds as a flat map for
 * use in CI comparison scripts.
 */
export function getPerformanceBudgets() {
  return {
    lcp: 2500,
    fid: 100,
    cls: 0.1,
    fcp: 1500,
    tti: 3500,
    si: 3000,
    tbt: 200,
    totalJsKb: 300,
    totalCssKb: 50,
    totalResourceKb: 1000,
    maxScriptCount: 15,
    maxFontCount: 4,
  };
}

export default lighthouseConfig;
