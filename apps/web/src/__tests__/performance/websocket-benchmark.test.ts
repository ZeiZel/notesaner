/**
 * WebSocket / Yjs Sync Round-Trip Benchmark (Unit)
 *
 * Measures the performance of the Yjs document synchronisation pipeline
 * that underpins real-time collaboration. Tests the data-layer operations:
 *   - Encoding state vectors
 *   - Computing incremental updates
 *   - Applying remote updates
 *   - Merge conflict resolution
 *
 * Performance budget: < 50ms round-trip equivalent (encode + decode + apply)
 *
 * For actual WebSocket latency measurements, see the Playwright-based
 * benchmark in `__tests__/benchmarks/websocket-roundtrip.bench.ts`.
 *
 * @module performance/websocket-benchmark
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as Y from 'yjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WsBenchmarkResult {
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
    stddev: number;
  };
  metadata: Record<string, unknown>;
  timestamp: string;
  withinBudget: boolean;
  budgetMs: number;
}

interface WsBenchmarkSuite {
  suite: string;
  environment: string;
  nodeVersion: string;
  results: WsBenchmarkResult[];
  runDate: string;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stddev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const sq = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return Math.sqrt(sq / (values.length - 1));
}

function collect(
  name: string,
  category: string,
  durations: number[],
  budgetMs: number,
  metadata: Record<string, unknown> = {},
): WsBenchmarkResult {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  return {
    name,
    category,
    iterations: sorted.length,
    timings: {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: parseFloat(mean.toFixed(3)),
      median: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      stddev: parseFloat(stddev(sorted, mean).toFixed(3)),
    },
    metadata,
    timestamp: new Date().toISOString(),
    withinBudget: percentile(sorted, 95) <= budgetMs,
    budgetMs,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateContent(lineCount: number): string {
  const lines: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(`Line ${i}: The quick brown fox jumps over the lazy dog. Content ${i}.`);
  }
  return lines.join('\n');
}

function createDocWithContent(content: string): Y.Doc {
  const doc = new Y.Doc();
  doc.getText('content').insert(0, content);
  return doc;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITERATIONS = 100;
const suiteResults: WsBenchmarkResult[] = [];

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

describe('WebSocket / Yjs Sync Benchmarks', () => {
  afterAll(() => {
    const suite: WsBenchmarkSuite = {
      suite: 'websocket-benchmark',
      environment: 'unit',
      nodeVersion: process.version,
      results: suiteResults,
      runDate: new Date().toISOString(),
    };

    console.log('\n--- BENCHMARK RESULTS (JSON) ---');
    console.log(JSON.stringify(suite, null, 2));
    console.log('--- END BENCHMARK RESULTS ---\n');
  });

  // ─── Full sync round-trip simulation ─────────────────────────────────────

  describe('Sync round-trip (encode + transmit + apply)', () => {
    it('single edit round-trip in 1K doc (p95 < 50ms)', () => {
      const content = generateContent(1000);
      const clientDoc = createDocWithContent(content);
      const serverDoc = new Y.Doc();

      // Initial sync
      const initialUpdate = Y.encodeStateAsUpdate(clientDoc);
      Y.applyUpdate(serverDoc, initialUpdate);

      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const clientText = clientDoc.getText('content');
        const pos = Math.floor(Math.random() * clientText.length);
        const beforeSv = Y.encodeStateVector(clientDoc);

        const start = performance.now();

        // 1. Client makes edit
        clientText.insert(pos, `edit-${i}`);

        // 2. Encode incremental update
        const update = Y.encodeStateAsUpdate(clientDoc, beforeSv);

        // 3. Simulate serialisation (would go over WebSocket)
        const serialised = new Uint8Array(update);

        // 4. Server applies update
        Y.applyUpdate(serverDoc, serialised);

        // 5. Server encodes acknowledgment state vector
        const _serverSv = Y.encodeStateVector(serverDoc);

        durations.push(performance.now() - start);
      }

      const result = collect(
        'Single edit sync round-trip (1K doc)',
        'sync-roundtrip',
        durations,
        50,
        { lines: 1000 },
      );
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);

      clientDoc.destroy();
      serverDoc.destroy();
    });

    it('single edit round-trip in 10K doc (p95 < 50ms)', () => {
      const content = generateContent(10_000);
      const clientDoc = createDocWithContent(content);
      const serverDoc = new Y.Doc();

      const initialUpdate = Y.encodeStateAsUpdate(clientDoc);
      Y.applyUpdate(serverDoc, initialUpdate);

      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const clientText = clientDoc.getText('content');
        const pos = Math.floor(Math.random() * clientText.length);
        const beforeSv = Y.encodeStateVector(clientDoc);

        const start = performance.now();

        clientText.insert(pos, `edit-${i}`);
        const update = Y.encodeStateAsUpdate(clientDoc, beforeSv);
        const serialised = new Uint8Array(update);
        Y.applyUpdate(serverDoc, serialised);
        const _serverSv = Y.encodeStateVector(serverDoc);

        durations.push(performance.now() - start);
      }

      const result = collect(
        'Single edit sync round-trip (10K doc)',
        'sync-roundtrip',
        durations,
        50,
        { lines: 10_000 },
      );
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);

      clientDoc.destroy();
      serverDoc.destroy();
    });
  });

  // ─── Multi-client merge ──────────────────────────────────────────────────

  describe('Multi-client concurrent edits', () => {
    it('merge 2 concurrent edits in 1K doc (p95 < 50ms)', () => {
      const content = generateContent(1000);
      const serverDoc = createDocWithContent(content);
      const client1Doc = new Y.Doc();
      const client2Doc = new Y.Doc();

      // Sync all clients
      const initialState = Y.encodeStateAsUpdate(serverDoc);
      Y.applyUpdate(client1Doc, initialState);
      Y.applyUpdate(client2Doc, initialState);

      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const c1Sv = Y.encodeStateVector(client1Doc);
        const c2Sv = Y.encodeStateVector(client2Doc);

        const start = performance.now();

        // Both clients edit concurrently
        const c1Text = client1Doc.getText('content');
        const c2Text = client2Doc.getText('content');

        c1Text.insert(0, `c1-${i} `);
        c2Text.insert(c2Text.length, ` c2-${i}`);

        // Encode both updates
        const c1Update = Y.encodeStateAsUpdate(client1Doc, c1Sv);
        const c2Update = Y.encodeStateAsUpdate(client2Doc, c2Sv);

        // Server merges both
        Y.applyUpdate(serverDoc, c1Update);
        Y.applyUpdate(serverDoc, c2Update);

        // Cross-sync clients
        Y.applyUpdate(client1Doc, c2Update);
        Y.applyUpdate(client2Doc, c1Update);

        durations.push(performance.now() - start);
      }

      const result = collect('Merge 2 concurrent edits (1K doc)', 'sync-merge', durations, 50, {
        clients: 2,
        lines: 1000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);

      serverDoc.destroy();
      client1Doc.destroy();
      client2Doc.destroy();
    });

    it('merge 5 concurrent edits in 1K doc (p95 < 50ms)', () => {
      const content = generateContent(1000);
      const serverDoc = createDocWithContent(content);
      const clients: Y.Doc[] = [];

      // Create 5 clients
      for (let c = 0; c < 5; c++) {
        const clientDoc = new Y.Doc();
        Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));
        clients.push(clientDoc);
      }

      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const stateVectors = clients.map((c) => Y.encodeStateVector(c));

        const start = performance.now();

        // All clients edit concurrently
        const updates: Uint8Array[] = [];
        for (let c = 0; c < clients.length; c++) {
          const text = clients[c].getText('content');
          text.insert(Math.floor(Math.random() * text.length), `c${c}-${i}`);
          updates.push(Y.encodeStateAsUpdate(clients[c], stateVectors[c]));
        }

        // Server merges all
        for (const update of updates) {
          Y.applyUpdate(serverDoc, update);
        }

        // Cross-sync all clients
        for (const client of clients) {
          for (const update of updates) {
            Y.applyUpdate(client, update);
          }
        }

        durations.push(performance.now() - start);
      }

      const result = collect('Merge 5 concurrent edits (1K doc)', 'sync-merge', durations, 50, {
        clients: 5,
        lines: 1000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);

      serverDoc.destroy();
      clients.forEach((c) => c.destroy());
    });
  });

  // ─── State vector operations ─────────────────────────────────────────────

  describe('State vector operations', () => {
    it('encode/decode state vector for 10K doc (p95 < 5ms)', () => {
      const content = generateContent(10_000);
      const doc = createDocWithContent(content);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        const sv = Y.encodeStateVector(doc);
        // Simulate receiving remote state vector and computing diff
        const diff = Y.encodeStateAsUpdate(doc, sv);
        const _diffSize = diff.byteLength;

        durations.push(performance.now() - start);
      }

      const result = collect('State vector encode/diff (10K doc)', 'sync-sv', durations, 5, {
        lines: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(5);

      doc.destroy();
    });
  });

  // ─── Full document sync ──────────────────────────────────────────────────

  describe('Full document sync', () => {
    it('full sync of 1K doc to new client (p95 < 50ms)', () => {
      const content = generateContent(1000);
      const serverDoc = createDocWithContent(content);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        // Encode full state
        const fullState = Y.encodeStateAsUpdate(serverDoc);

        // New client applies full state
        const clientDoc = new Y.Doc();
        Y.applyUpdate(clientDoc, fullState);

        // Verify sync
        const _clientText = clientDoc.getText('content').toString();

        durations.push(performance.now() - start);
        clientDoc.destroy();
      }

      const result = collect('Full doc sync to new client (1K doc)', 'sync-full', durations, 50, {
        lines: 1000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);

      serverDoc.destroy();
    });

    it('full sync of 10K doc to new client (p95 < 200ms)', () => {
      const content = generateContent(10_000);
      const serverDoc = createDocWithContent(content);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        const fullState = Y.encodeStateAsUpdate(serverDoc);
        const clientDoc = new Y.Doc();
        Y.applyUpdate(clientDoc, fullState);
        const _clientText = clientDoc.getText('content').toString();

        durations.push(performance.now() - start);
        clientDoc.destroy();
      }

      const result = collect('Full doc sync to new client (10K doc)', 'sync-full', durations, 200, {
        lines: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(200);

      serverDoc.destroy();
    });
  });
});
