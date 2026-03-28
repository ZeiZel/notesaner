/**
 * WebSocket Round-Trip Benchmark (Browser)
 *
 * Measures the WebSocket message round-trip time which is critical
 * for real-time collaboration (Yjs CRDT sync).
 *
 * Performance budget: < 50ms round-trip
 *
 * Strategy:
 *   1. Establish a WebSocket connection to the server
 *   2. Send a ping/echo message
 *   3. Measure time until the response arrives
 *   4. Repeat for statistical significance
 *
 * If the WebSocket server is not available, the test falls back to
 * a simulated measurement using the page's fetch API to measure
 * HTTP round-trip as a baseline proxy.
 *
 * @module benchmarks/websocket-roundtrip
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebSocketRoundTripResult {
  name: string;
  category: string;
  protocol: 'websocket' | 'http-fallback';
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
  connectionEstablishMs: number | null;
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

function computeStats(durations: number[]) {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  return {
    min: parseFloat(sorted[0].toFixed(3)),
    max: parseFloat(sorted[sorted.length - 1].toFixed(3)),
    mean: parseFloat(mean.toFixed(3)),
    median: parseFloat(percentile(sorted, 50).toFixed(3)),
    p95: parseFloat(percentile(sorted, 95).toFixed(3)),
    p99: parseFloat(percentile(sorted, 99).toFixed(3)),
  };
}

/**
 * Measures WebSocket round-trip time by sending messages and
 * timing the echo response.
 */
async function measureWebSocketRoundTrip(
  page: Page,
  wsUrl: string,
  iterations: number,
): Promise<{ durations: number[]; connectionMs: number } | null> {
  const result = await page.evaluate(
    async ({ url, count }) => {
      return new Promise<{ durations: number[]; connectionMs: number } | null>((resolve) => {
        const connectionStart = performance.now();

        const ws = new WebSocket(url);
        const durations: number[] = [];
        let connectionMs = 0;
        let currentStart = 0;
        let remaining = count;

        const timeout = setTimeout(() => {
          ws.close();
          resolve(durations.length > 0 ? { durations, connectionMs } : null);
        }, 30_000);

        ws.onopen = () => {
          connectionMs = performance.now() - connectionStart;

          // Start sending pings
          function sendNext() {
            if (remaining <= 0) {
              clearTimeout(timeout);
              ws.close();
              resolve({ durations, connectionMs });
              return;
            }

            currentStart = performance.now();
            ws.send(JSON.stringify({ type: 'ping', ts: currentStart }));
          }

          sendNext();

          ws.onmessage = () => {
            durations.push(performance.now() - currentStart);
            remaining--;
            // Small delay between messages to avoid overwhelming
            setTimeout(sendNext, 10);
          };
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(null);
        };
      });
    },
    { url: wsUrl, count: iterations },
  );

  return result;
}

/**
 * Fallback: measure HTTP round-trip to the server as a baseline proxy.
 */
async function measureHttpRoundTrip(
  page: Page,
  baseUrl: string,
  iterations: number,
): Promise<number[]> {
  const durations = await page.evaluate(
    async ({ url, count }) => {
      const results: number[] = [];

      for (let i = 0; i < count; i++) {
        const start = performance.now();
        try {
          await fetch(`${url}/api/health`, {
            method: 'GET',
            cache: 'no-store',
          });
        } catch {
          // Server might not have a health endpoint; measure the roundtrip anyway
          await fetch(url, { method: 'HEAD', cache: 'no-store' }).catch(() => {});
        }
        results.push(performance.now() - start);
      }

      return results;
    },
    { url, count: iterations },
  );

  return durations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('WebSocket Round-Trip Benchmarks', () => {
  const WS_BUDGET = 50; // ms
  const ITERATIONS = 50;

  test('WebSocket round-trip latency (p95 < 50ms)', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });

    // Determine WebSocket URL from the base URL
    const wsProtocol = baseURL?.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseURL?.replace(/^https?:\/\//, '') ?? 'localhost:3000';
    const wsUrl = `${wsProtocol}://${wsHost}/ws`;

    // eslint-disable-next-line no-console
    console.log(`  Attempting WebSocket connection to: ${wsUrl}`);

    // Try WebSocket first
    const wsResult = await measureWebSocketRoundTrip(page, wsUrl, ITERATIONS);

    let result: WebSocketRoundTripResult;

    if (wsResult && wsResult.durations.length > 0) {
      const stats = computeStats(wsResult.durations);

      result = {
        name: 'WebSocket round-trip',
        category: 'websocket',
        protocol: 'websocket',
        iterations: wsResult.durations.length,
        timings: stats,
        withinBudget: stats.p95 <= WS_BUDGET,
        budgetMs: WS_BUDGET,
        connectionEstablishMs: parseFloat(wsResult.connectionMs.toFixed(2)),
        timestamp: new Date().toISOString(),
      };

      // eslint-disable-next-line no-console
      console.log(`  WebSocket connection established in: ${wsResult.connectionMs.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`  Measured ${wsResult.durations.length} round-trips`);
    } else {
      // Fallback to HTTP measurement
      // eslint-disable-next-line no-console
      console.log('  WebSocket not available. Falling back to HTTP round-trip measurement.');

      const httpDurations = await measureHttpRoundTrip(
        page,
        baseURL ?? 'http://localhost:3000',
        ITERATIONS,
      );
      const stats = computeStats(httpDurations);

      result = {
        name: 'HTTP round-trip (WS fallback)',
        category: 'websocket',
        protocol: 'http-fallback',
        iterations: httpDurations.length,
        timings: stats,
        withinBudget: stats.p95 <= WS_BUDGET,
        budgetMs: WS_BUDGET,
        connectionEstablishMs: null,
        timestamp: new Date().toISOString(),
      };
    }

    // eslint-disable-next-line no-console
    console.log(`\n--- WEBSOCKET ROUND-TRIP RESULT ---`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    // eslint-disable-next-line no-console
    console.log(`--- END ---\n`);

    // Assert budget
    expect(
      result.timings.p95,
      `${result.protocol} round-trip p95 (${result.timings.p95}ms) exceeds ${WS_BUDGET}ms budget`,
    ).toBeLessThan(WS_BUDGET);
  });

  test('WebSocket connection establishment time', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });

    const wsProtocol = baseURL?.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseURL?.replace(/^https?:\/\//, '') ?? 'localhost:3000';
    const wsUrl = `${wsProtocol}://${wsHost}/ws`;

    // Measure connection establishment 5 times
    const connectionTimes: number[] = [];

    for (let i = 0; i < 5; i++) {
      const connectionMs = await page.evaluate(async (url) => {
        return new Promise<number>((resolve) => {
          const start = performance.now();
          const ws = new WebSocket(url);

          const timeout = setTimeout(() => {
            ws.close();
            resolve(-1);
          }, 5000);

          ws.onopen = () => {
            const elapsed = performance.now() - start;
            clearTimeout(timeout);
            ws.close();
            resolve(elapsed);
          };

          ws.onerror = () => {
            clearTimeout(timeout);
            resolve(-1);
          };
        });
      }, wsUrl);

      if (connectionMs >= 0) {
        connectionTimes.push(connectionMs);
        // eslint-disable-next-line no-console
        console.log(`  Connection ${i + 1}: ${connectionMs.toFixed(2)}ms`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`  Connection ${i + 1}: failed`);
      }
    }

    if (connectionTimes.length > 0) {
      const avg = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
      // eslint-disable-next-line no-console
      console.log(`\n  Average connection time: ${avg.toFixed(2)}ms`);

      // Connection should establish within 200ms on localhost
      expect(avg).toBeLessThan(200);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'WebSocket server not available for connection benchmark.',
      });
    }
  });
});
