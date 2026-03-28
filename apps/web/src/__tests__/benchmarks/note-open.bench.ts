/**
 * Note Open Time Benchmark (Browser)
 *
 * Measures the end-to-end time to open a note in the editor, including:
 *   - Navigation to the note URL
 *   - API response wait
 *   - Editor initialisation and first render
 *
 * Performance budget: < 200ms for note open time
 *
 * This benchmark complements the unit-level Yjs/parse benchmarks in
 * `editor-performance.test.ts` by measuring the full browser pipeline.
 *
 * @module benchmarks/note-open
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoteOpenResult {
  name: string;
  category: string;
  measurements: NoteOpenMeasurement[];
  averageMs: number;
  p95Ms: number;
  withinBudget: boolean;
  budgetMs: number;
  timestamp: string;
}

interface NoteOpenMeasurement {
  run: number;
  navigationMs: number;
  domReadyMs: number;
  editorVisibleMs: number;
  totalMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Measures the time from initiating navigation to the editor becoming visible.
 *
 * The measurement strategy:
 *  1. Start timer
 *  2. Navigate to note URL
 *  3. Wait for editor element to appear in DOM
 *  4. Stop timer
 */
async function measureNoteOpenTime(
  page: Page,
  noteUrl: string,
  editorSelector: string,
): Promise<NoteOpenMeasurement & { success: boolean }> {
  const start = Date.now();

  try {
    const _response = await page.goto(noteUrl, { waitUntil: 'commit' });
    const navigationMs = Date.now() - start;

    // Wait for DOM content loaded
    await page.waitForLoadState('domcontentloaded');
    const domReadyMs = Date.now() - start;

    // Wait for editor to appear
    await page.waitForSelector(editorSelector, { timeout: 10_000, state: 'visible' });
    const editorVisibleMs = Date.now() - start;

    return {
      run: 0,
      navigationMs,
      domReadyMs,
      editorVisibleMs,
      totalMs: editorVisibleMs,
      success: true,
    };
  } catch {
    return {
      run: 0,
      navigationMs: Date.now() - start,
      domReadyMs: Date.now() - start,
      editorVisibleMs: Date.now() - start,
      totalMs: Date.now() - start,
      success: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Note Open Time Benchmarks', () => {
  const NOTE_OPEN_BUDGET = 200; // ms
  const RUNS = 5;

  // Common editor selectors to try
  const EDITOR_SELECTORS = [
    '[contenteditable="true"]',
    '.cm-editor',
    '.ProseMirror',
    '.tiptap',
    '[data-testid="editor"]',
    'textarea',
  ];

  test('note open time should be < 200ms (p95)', async ({ page, baseURL }) => {
    // First, determine what route and editor are available
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });

    // Try to find navigation to a note or any interactive content
    const allLinks = await page.locator('a[href]').all();
    let noteUrl = `${baseURL}/`;

    // Try to find a note-related link
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (
        href &&
        (href.includes('note') || href.includes('editor') || href.includes('workspace'))
      ) {
        noteUrl = href.startsWith('http') ? href : `${baseURL}${href}`;
        break;
      }
    }

    // Determine which editor selector works
    let editorSelector = EDITOR_SELECTORS[0];
    for (const selector of EDITOR_SELECTORS) {
      const exists = await page
        .locator(selector)
        .first()
        .isVisible()
        .catch(() => false);
      if (exists) {
        editorSelector = selector;
        break;
      }
    }

    const measurements: NoteOpenMeasurement[] = [];

    for (let run = 0; run < RUNS; run++) {
      // Navigate away first to get a clean measurement
      await page.goto('about:blank');
      await page.waitForTimeout(100);

      const measurement = await measureNoteOpenTime(page, noteUrl, editorSelector);
      measurement.run = run + 1;
      measurements.push(measurement);

      // eslint-disable-next-line no-console
      console.log(
        `  Run ${run + 1}/${RUNS}: nav=${measurement.navigationMs}ms, ` +
          `DOM=${measurement.domReadyMs}ms, editor=${measurement.editorVisibleMs}ms, ` +
          `total=${measurement.totalMs}ms`,
      );
    }

    const totalTimes = measurements.map((m) => m.totalMs);
    const sorted = [...totalTimes].sort((a, b) => a - b);
    const avg = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length;
    const p95 = percentile(sorted, 95);

    const result: NoteOpenResult = {
      name: 'Note open time',
      category: 'note-open',
      measurements,
      averageMs: parseFloat(avg.toFixed(2)),
      p95Ms: parseFloat(p95.toFixed(2)),
      withinBudget: p95 <= NOTE_OPEN_BUDGET,
      budgetMs: NOTE_OPEN_BUDGET,
      timestamp: new Date().toISOString(),
    };

    // eslint-disable-next-line no-console
    console.log(`\n--- NOTE OPEN RESULT ---`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    // eslint-disable-next-line no-console
    console.log(`--- END ---\n`);

    // Assert: p95 within budget
    // Soft assertion in development since the app might not have full routes yet
    test.info().annotations.push({
      type: 'budget',
      description: `p95=${p95.toFixed(2)}ms, budget=${NOTE_OPEN_BUDGET}ms`,
    });

    if (measurements.every((m) => m.totalMs > 0)) {
      expect(
        p95,
        `Note open p95 (${p95.toFixed(2)}ms) exceeds ${NOTE_OPEN_BUDGET}ms budget`,
      ).toBeLessThan(NOTE_OPEN_BUDGET);
    }
  });

  test('note open navigation timing breakdown', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'load' });

    // Collect Navigation Timing API data
    const timingData = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      if (!nav) return null;

      return {
        dns: nav.domainLookupEnd - nav.domainLookupStart,
        tcp: nav.connectEnd - nav.connectStart,
        ttfb: nav.responseStart - nav.requestStart,
        download: nav.responseEnd - nav.responseStart,
        domParsing: nav.domInteractive - nav.responseEnd,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
        loadEvent: nav.loadEventEnd - nav.loadEventStart,
        totalNavigation: nav.loadEventEnd - nav.startTime,
      };
    });

    if (timingData) {
      // eslint-disable-next-line no-console
      console.log(`\n--- NAVIGATION TIMING BREAKDOWN ---`);
      // eslint-disable-next-line no-console
      console.log(`  DNS lookup:        ${timingData.dns.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`  TCP connection:    ${timingData.tcp.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`  TTFB:              ${timingData.ttfb.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`  Download:          ${timingData.download.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`  DOM parsing:       ${timingData.domParsing.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`  DOMContentLoaded:  ${timingData.domContentLoaded.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`  Load event:        ${timingData.loadEvent.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`  Total navigation:  ${timingData.totalNavigation.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`--- END ---\n`);
    }

    expect(timingData).not.toBeNull();
  });
});
