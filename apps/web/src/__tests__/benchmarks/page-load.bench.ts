/**
 * Page Load / LCP Benchmark (Browser)
 *
 * Measures real browser page load performance including:
 *   - Largest Contentful Paint (LCP) < 2s
 *   - First Contentful Paint (FCP)
 *   - DOM Content Loaded
 *   - Full page load time
 *
 * Uses the Performance API and PerformanceObserver to capture
 * real browser metrics that Lighthouse would also measure.
 *
 * @module benchmarks/page-load
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageLoadMetrics {
  url: string;
  fcp: number | null;
  lcp: number | null;
  domContentLoaded: number;
  loadComplete: number;
  ttfb: number;
  resourceCount: number;
  transferSize: number;
  timestamp: string;
}

interface PageLoadBenchmarkResult {
  name: string;
  category: string;
  metrics: PageLoadMetrics[];
  averages: {
    fcp: number | null;
    lcp: number | null;
    domContentLoaded: number;
    loadComplete: number;
    ttfb: number;
  };
  budgets: {
    lcp: { budget: number; met: boolean };
    fcp: { budget: number; met: boolean };
  };
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function measurePageLoad(page: Page, url: string): Promise<PageLoadMetrics> {
  // Install LCP observer before navigation
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__lcpValue = null;

    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        (window as unknown as Record<string, unknown>).__lcpValue = lastEntry.startTime;
      }
    });

    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    (window as unknown as Record<string, unknown>).__lcpObserver = lcpObserver;
  });

  // Navigate and wait for full load
  const navigationStart = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  const loadTime = Date.now() - navigationStart;

  // Wait a bit for LCP to settle
  await page.waitForTimeout(1000);

  // Collect metrics
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
    const lcp = (window as unknown as Record<string, number | null>).__lcpValue;

    // Disconnect observer
    const obs = (window as unknown as Record<string, PerformanceObserver>).__lcpObserver;
    obs?.disconnect();

    const totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

    return {
      fcp: fcpEntry ? fcpEntry.startTime : null,
      lcp,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
      ttfb: nav ? nav.responseStart - nav.startTime : 0,
      resourceCount: resources.length,
      transferSize: totalTransferSize,
    };
  });

  return {
    url,
    fcp: metrics.fcp ? parseFloat(metrics.fcp.toFixed(2)) : null,
    lcp: metrics.lcp ? parseFloat(metrics.lcp.toFixed(2)) : null,
    domContentLoaded: parseFloat(metrics.domContentLoaded.toFixed(2)),
    loadComplete: loadTime,
    ttfb: parseFloat(metrics.ttfb.toFixed(2)),
    resourceCount: metrics.resourceCount,
    transferSize: metrics.transferSize,
    timestamp: new Date().toISOString(),
  };
}

function average(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Page Load Performance Benchmarks', () => {
  const RUNS_PER_URL = 3;
  const LCP_BUDGET = 2000; // 2s
  const FCP_BUDGET = 1500; // 1.5s

  const CRITICAL_URLS = [{ path: '/', name: 'Landing / Dashboard' }];

  for (const { path, name } of CRITICAL_URLS) {
    test(`LCP for "${name}" (${path}) should be < ${LCP_BUDGET}ms`, async ({ page, baseURL }) => {
      const url = `${baseURL}${path}`;
      const allMetrics: PageLoadMetrics[] = [];

      for (let run = 0; run < RUNS_PER_URL; run++) {
        // Clear browser state between runs
        await page.context().clearCookies();

        const metrics = await measurePageLoad(page, url);
        allMetrics.push(metrics);

        // eslint-disable-next-line no-console
        console.log(
          `  Run ${run + 1}/${RUNS_PER_URL}: FCP=${metrics.fcp}ms, LCP=${metrics.lcp}ms, ` +
            `DCL=${metrics.domContentLoaded}ms, Load=${metrics.loadComplete}ms, ` +
            `TTFB=${metrics.ttfb}ms, Resources=${metrics.resourceCount}`,
        );
      }

      const avgLcp = average(allMetrics.map((m) => m.lcp));
      const avgFcp = average(allMetrics.map((m) => m.fcp));

      const result: PageLoadBenchmarkResult = {
        name: `Page Load: ${name}`,
        category: 'page-load',
        metrics: allMetrics,
        averages: {
          fcp: avgFcp,
          lcp: avgLcp,
          domContentLoaded: average(allMetrics.map((m) => m.domContentLoaded)) ?? 0,
          loadComplete: average(allMetrics.map((m) => m.loadComplete)) ?? 0,
          ttfb: average(allMetrics.map((m) => m.ttfb)) ?? 0,
        },
        budgets: {
          lcp: { budget: LCP_BUDGET, met: avgLcp !== null ? avgLcp < LCP_BUDGET : true },
          fcp: { budget: FCP_BUDGET, met: avgFcp !== null ? avgFcp < FCP_BUDGET : true },
        },
        timestamp: new Date().toISOString(),
      };

      // eslint-disable-next-line no-console
      console.log(`\n--- PAGE LOAD RESULT ---`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
      // eslint-disable-next-line no-console
      console.log(`--- END ---\n`);

      // Assert LCP budget
      if (avgLcp !== null) {
        expect(
          avgLcp,
          `Average LCP for ${name} (${avgLcp}ms) exceeds ${LCP_BUDGET}ms budget`,
        ).toBeLessThan(LCP_BUDGET);
      }
    });
  }

  test('initial page load should have reasonable resource counts', async ({ page, baseURL }) => {
    const metrics = await measurePageLoad(page, `${baseURL}/`);

    // eslint-disable-next-line no-console
    console.log(`\n--- RESOURCE COUNT ---`);
    // eslint-disable-next-line no-console
    console.log(`  Resources: ${metrics.resourceCount}`);
    // eslint-disable-next-line no-console
    console.log(`  Transfer size: ${(metrics.transferSize / 1024).toFixed(1)} KB`);
    // eslint-disable-next-line no-console
    console.log(`--- END ---\n`);

    // Soft limits for initial page load
    expect(metrics.resourceCount).toBeLessThan(50);
    expect(metrics.transferSize).toBeLessThan(1_500_000); // 1.5 MB
  });
});
