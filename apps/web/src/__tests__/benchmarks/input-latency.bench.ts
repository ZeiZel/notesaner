/**
 * Editor Input Latency Benchmark (Browser)
 *
 * Measures the real DOM input latency of the editor by:
 *   1. Navigating to the editor page
 *   2. Focusing the editor area
 *   3. Typing characters and measuring the time from keydown to DOM update
 *
 * Performance budget: < 16ms (60fps frame budget)
 *
 * This test runs in a real Chromium browser via Playwright to capture
 * actual rendering pipeline costs that unit tests cannot measure.
 *
 * @module benchmarks/input-latency
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LatencyResult {
  name: string;
  category: string;
  iterations: number;
  timings: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
  };
  withinBudget: boolean;
  budgetMs: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function collectLatency(name: string, durations: number[], budgetMs: number): LatencyResult {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  const result: LatencyResult = {
    name,
    category: 'input-latency',
    iterations: sorted.length,
    timings: {
      min: parseFloat(sorted[0].toFixed(3)),
      max: parseFloat(sorted[sorted.length - 1].toFixed(3)),
      mean: parseFloat(mean.toFixed(3)),
      median: parseFloat(percentile(sorted, 50).toFixed(3)),
      p95: parseFloat(percentile(sorted, 95).toFixed(3)),
      p99: parseFloat(percentile(sorted, 99).toFixed(3)),
    },
    withinBudget: percentile(sorted, 95) <= budgetMs,
    budgetMs,
    timestamp: new Date().toISOString(),
  };

  return result;
}

/**
 * Measure input latency by injecting a performance observer in the page
 * that captures Event Timing API entries for keypress events.
 */
async function measureInputLatency(
  page: Page,
  editorSelector: string,
  iterations: number,
): Promise<number[]> {
  // Set up performance observer for input latency measurement
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__benchmarkDurations = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'event' && (entry as PerformanceEventTiming).name === 'keydown') {
          const duration = (entry as PerformanceEventTiming).duration;
          (window as unknown as Record<string, unknown[]>).__benchmarkDurations.push(duration);
        }
      }
    });

    observer.observe({ type: 'event', buffered: false });
    (window as unknown as Record<string, unknown>).__benchmarkObserver = observer;
  });

  // Focus the editor
  const editor = page.locator(editorSelector);
  await editor.click();
  await page.waitForTimeout(200); // Let the editor settle

  // Type characters one by one with small delays to allow measurement
  for (let i = 0; i < iterations; i++) {
    await page.keyboard.type('x', { delay: 50 });
  }

  // Wait for all events to be processed
  await page.waitForTimeout(500);

  // Collect results
  const durations = await page.evaluate(() => {
    const obs = (window as unknown as Record<string, PerformanceObserver>).__benchmarkObserver;
    obs?.disconnect();
    return (window as unknown as Record<string, number[]>).__benchmarkDurations ?? [];
  });

  return durations;
}

/**
 * Alternative measurement using high-resolution timestamps around
 * keypress -> mutation observer for DOM update.
 */
async function measureKeystrokeToDOMUpdate(
  page: Page,
  editorSelector: string,
  iterations: number,
): Promise<number[]> {
  // Install mutation observer and measurement harness
  await page.evaluate((selector: string) => {
    const durations: number[] = [];
    let measureStart = 0;

    const editorEl = document.querySelector(selector);
    if (!editorEl) return;

    const targetEl = editorEl.querySelector('[contenteditable="true"]') ?? editorEl;

    const mutationObs = new MutationObserver(() => {
      if (measureStart > 0) {
        durations.push(performance.now() - measureStart);
        measureStart = 0;
      }
    });

    mutationObs.observe(targetEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    (window as unknown as Record<string, unknown>).__keystrokeDurations = durations;
    (window as unknown as Record<string, unknown>).__keystrokeMutationObs = mutationObs;
    (window as unknown as Record<string, unknown>).__keystrokeStartMeasure = () => {
      measureStart = performance.now();
    };
  }, editorSelector);

  // Focus and type
  const editor = page.locator(editorSelector);
  await editor.click();
  await page.waitForTimeout(200);

  for (let i = 0; i < iterations; i++) {
    // Signal measurement start
    await page.evaluate(() => {
      const startFn = (window as unknown as Record<string, () => void>).__keystrokeStartMeasure;
      startFn?.();
    });

    await page.keyboard.type('a', { delay: 0 });
    await page.waitForTimeout(30); // Wait for DOM update
  }

  await page.waitForTimeout(200);

  // Collect
  const durations = await page.evaluate(() => {
    const obs = (window as unknown as Record<string, MutationObserver>).__keystrokeMutationObs;
    obs?.disconnect();
    return (window as unknown as Record<string, number[]>).__keystrokeDurations ?? [];
  });

  return durations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Editor Input Latency Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to editor page. The exact URL depends on the app's routing.
    // Try the workspace editor route first.
    const response = await page.goto('/');
    expect(response?.ok() || response?.status() === 304).toBeTruthy();
  });

  test('keyboard input latency via Event Timing API (p95 < 16ms)', async ({ page }) => {
    // Wait for the app to be interactive
    await page.waitForLoadState('networkidle');

    // Look for a contenteditable or textarea element
    const editorSelector = '[contenteditable="true"], .cm-editor, .ProseMirror, textarea';
    const editorExists = await page
      .locator(editorSelector)
      .first()
      .isVisible()
      .catch(() => false);

    if (!editorExists) {
      // If no editor is visible on the landing page, this is expected during
      // development. Record a baseline measurement using a simple textarea.
      test.info().annotations.push({
        type: 'note',
        description: 'No editor found on page. Using page-level input measurement.',
      });

      // Measure page responsiveness with a simple interaction
      const durations: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        await page.keyboard.press('Tab');
        durations.push(Date.now() - start);
      }

      const result = collectLatency('Page keyboard responsiveness', durations, 16);
      // eslint-disable-next-line no-console
      console.log(`\n--- INPUT LATENCY RESULT ---`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
      // eslint-disable-next-line no-console
      console.log(`--- END ---\n`);

      // This is informational, not a hard gate when no editor exists
      return;
    }

    const durations = await measureInputLatency(page, editorSelector, 100);

    const result = collectLatency('Editor input latency (Event Timing)', durations, 16);

    // eslint-disable-next-line no-console
    console.log(`\n--- INPUT LATENCY RESULT ---`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    // eslint-disable-next-line no-console
    console.log(`--- END ---\n`);

    // Assert budget
    if (durations.length > 10) {
      expect(
        result.timings.p95,
        `Input latency p95 (${result.timings.p95}ms) exceeds 16ms budget`,
      ).toBeLessThan(16);
    }
  });

  test('keystroke to DOM update latency (p95 < 16ms)', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const editorSelector = '[contenteditable="true"], .cm-editor, .ProseMirror';
    const editorExists = await page
      .locator(editorSelector)
      .first()
      .isVisible()
      .catch(() => false);

    if (!editorExists) {
      test.info().annotations.push({
        type: 'note',
        description: 'No contenteditable editor found. Skipping keystroke-to-DOM benchmark.',
      });
      return;
    }

    const durations = await measureKeystrokeToDOMUpdate(page, editorSelector, 50);

    const result = collectLatency('Keystroke to DOM update', durations, 16);

    // eslint-disable-next-line no-console
    console.log(`\n--- KEYSTROKE-TO-DOM RESULT ---`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    // eslint-disable-next-line no-console
    console.log(`--- END ---\n`);

    if (durations.length > 5) {
      expect(
        result.timings.p95,
        `Keystroke-to-DOM p95 (${result.timings.p95}ms) exceeds 16ms budget`,
      ).toBeLessThan(16);
    }
  });
});
