/**
 * Yjs Sync Performance Benchmarks
 *
 * Measures the performance characteristics of the CRDT sync layer:
 *   - Single-client update apply/encode cycle
 *   - Multi-client concurrent editing merge
 *   - Large document state vector and diff encoding
 *   - Reconnection with offline changes (conflict resolution)
 *   - Frontmatter resolution throughput
 *   - Document serialisation for persistence
 *
 * Performance budgets (p95):
 *   - Single update apply:           < 10ms
 *   - Multi-client merge (5 clients): < 50ms
 *   - Reconnection with 100 updates: < 200ms
 *   - State encoding (10K line doc):  < 100ms
 *   - Frontmatter resolution:        < 5ms
 *
 * Results are emitted as JSON for CI regression tracking.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as Y from 'yjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncBenchmarkResult {
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

interface SyncBenchmarkSuite {
  suite: string;
  environment: string;
  nodeVersion: string;
  results: SyncBenchmarkResult[];
  runDate: string;
}

// ---------------------------------------------------------------------------
// Statistics helpers
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
): SyncBenchmarkResult {
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
// Document generators
// ---------------------------------------------------------------------------

/**
 * Create a Yjs document with the specified number of lines.
 * Each line is a realistic markdown line of ~80 characters.
 */
function createDocWithLines(lineCount: number): Y.Doc {
  const doc = new Y.Doc();
  const ytext = doc.getText('content');

  const lines: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    if (i % 100 === 0) {
      lines.push(`## Section ${Math.floor(i / 100) + 1}`);
    } else if (i % 10 === 0) {
      lines.push(`### Subsection ${i}`);
    } else if (i % 5 === 0) {
      lines.push(`- List item ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`);
    } else {
      lines.push(
        `Line ${i}: The quick brown fox jumps over the lazy dog. Performance benchmark content.`,
      );
    }
  }

  ytext.insert(0, lines.join('\n'));
  return doc;
}

/**
 * Simulate a client making a series of edits at random positions.
 * Returns the Yjs updates produced.
 */
function simulateClientEdits(baseDoc: Y.Doc, editCount: number, clientLabel: string): Uint8Array[] {
  const clientDoc = new Y.Doc();
  Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(baseDoc));

  const updates: Uint8Array[] = [];
  const ytext = clientDoc.getText('content');

  for (let i = 0; i < editCount; i++) {
    const len = ytext.length;
    const pos = len > 0 ? Math.floor(Math.random() * len) : 0;
    const beforeSv = Y.encodeStateVector(clientDoc);

    ytext.insert(pos, `[${clientLabel}-edit-${i}] `);

    const update = Y.encodeStateAsUpdate(clientDoc, beforeSv);
    updates.push(update);
  }

  return updates;
}

/**
 * Simulate frontmatter with timestamped fields.
 */
function createTimestampedFrontmatter(
  fields: Record<string, unknown>,
  updatedBy: string,
  baseTime: number,
) {
  const result: Record<string, { value: unknown; updatedAt: string; updatedBy: string }> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = {
      value,
      updatedAt: new Date(baseTime + Math.random() * 3600_000).toISOString(),
      updatedBy,
    };
  }
  return result;
}

/**
 * Per-field last-write-wins resolution (mirrors ConflictResolutionService logic).
 */
function resolveFrontmatterLWW(
  server: Record<string, { value: unknown; updatedAt: string; updatedBy: string }>,
  client: Record<string, { value: unknown; updatedAt: string; updatedBy: string }>,
) {
  const merged: Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(server), ...Object.keys(client)]);

  for (const key of allKeys) {
    const s = server[key];
    const c = client[key];

    if (s && !c) {
      merged[key] = s.value;
    } else if (!s && c) {
      merged[key] = c.value;
    } else if (s && c) {
      const st = new Date(s.updatedAt).getTime();
      const ct = new Date(c.updatedAt).getTime();
      merged[key] = ct > st ? c.value : s.value;
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITERATIONS = 100;
const suiteResults: SyncBenchmarkResult[] = [];

// ---------------------------------------------------------------------------
// Benchmark suite
// ---------------------------------------------------------------------------

describe('Yjs Sync Performance Benchmarks', () => {
  afterAll(() => {
    const suite: SyncBenchmarkSuite = {
      suite: 'sync-benchmarks',
      environment: 'unit',
      nodeVersion: process.version,
      results: suiteResults,
      runDate: new Date().toISOString(),
    };

    console.log('\n--- BENCHMARK RESULTS (JSON) ---');
    console.log(JSON.stringify(suite, null, 2));
    console.log('--- END BENCHMARK RESULTS ---\n');
  });

  // ─── Single Update Apply ────────────────────────────────────────────────

  describe('Single update apply', () => {
    it('apply single text insert to empty doc (p95 < 10ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const doc = new Y.Doc();
        const clientDoc = new Y.Doc();
        const ytext = clientDoc.getText('content');
        ytext.insert(0, `Edit ${i}: Hello, world! This is a benchmark insert.`);
        const update = Y.encodeStateAsUpdate(clientDoc);

        const start = performance.now();
        Y.applyUpdate(doc, update);
        durations.push(performance.now() - start);

        doc.destroy();
        clientDoc.destroy();
      }

      const result = collect('Apply single insert (empty doc)', 'update-apply', durations, 10, {
        docSize: 'empty',
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(10);
    });

    it('apply single text insert to 1000-line doc (p95 < 10ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const serverDoc = createDocWithLines(1000);
        const serverState = Y.encodeStateAsUpdate(serverDoc);

        const clientDoc = new Y.Doc();
        Y.applyUpdate(clientDoc, serverState);
        const beforeSv = Y.encodeStateVector(clientDoc);
        const ytext = clientDoc.getText('content');
        ytext.insert(ytext.length, `\nNew line from client ${i}`);
        const update = Y.encodeStateAsUpdate(clientDoc, beforeSv);

        const start = performance.now();
        Y.applyUpdate(serverDoc, update);
        durations.push(performance.now() - start);

        serverDoc.destroy();
        clientDoc.destroy();
      }

      const result = collect('Apply single insert (1K-line doc)', 'update-apply', durations, 10, {
        docSize: '1000 lines',
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(10);
    });
  });

  // ─── Multi-Client Merge ───────────────────────────────────────────────────

  describe('Multi-client concurrent editing', () => {
    it('merge edits from 5 clients (10 edits each) (p95 < 50ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const baseDoc = createDocWithLines(200);
        const clientCount = 5;
        const editsPerClient = 10;

        // Each client makes independent edits
        const clientUpdates: Uint8Array[][] = [];
        for (let c = 0; c < clientCount; c++) {
          const updates = simulateClientEdits(baseDoc, editsPerClient, `c${c}`);
          clientUpdates.push(updates);
        }

        // Merge all client updates into the server doc
        const start = performance.now();
        for (const updates of clientUpdates) {
          for (const update of updates) {
            Y.applyUpdate(baseDoc, update);
          }
        }
        durations.push(performance.now() - start);

        baseDoc.destroy();
      }

      const result = collect('Merge 5 clients x 10 edits', 'multi-client-merge', durations, 50, {
        clients: 5,
        editsPerClient: 10,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);
    });

    it('merge edits from 10 clients (20 edits each) (p95 < 100ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const baseDoc = createDocWithLines(500);
        const clientCount = 10;
        const editsPerClient = 20;

        const clientUpdates: Uint8Array[][] = [];
        for (let c = 0; c < clientCount; c++) {
          const updates = simulateClientEdits(baseDoc, editsPerClient, `c${c}`);
          clientUpdates.push(updates);
        }

        const start = performance.now();
        for (const updates of clientUpdates) {
          for (const update of updates) {
            Y.applyUpdate(baseDoc, update);
          }
        }
        durations.push(performance.now() - start);

        baseDoc.destroy();
      }

      const result = collect('Merge 10 clients x 20 edits', 'multi-client-merge', durations, 100, {
        clients: 10,
        editsPerClient: 20,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(100);
    });
  });

  // ─── Large Document Operations ────────────────────────────────────────────

  describe('Large document operations', () => {
    it('encode state vector for 10K-line doc (p95 < 100ms)', () => {
      const durations: number[] = [];
      const doc = createDocWithLines(10_000);

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const sv = Y.encodeStateVector(doc);
        // Force the result to be used (prevent dead-code elimination)
        if (sv.byteLength === 0) throw new Error('unexpected');
        durations.push(performance.now() - start);
      }

      const docSize = Y.encodeStateAsUpdate(doc).byteLength;
      const result = collect('Encode state vector (10K lines)', 'large-doc', durations, 100, {
        lines: 10_000,
        docSizeBytes: docSize,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(100);

      doc.destroy();
    });

    it('encode full state update for 10K-line doc (p95 < 100ms)', () => {
      const durations: number[] = [];
      const doc = createDocWithLines(10_000);

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const update = Y.encodeStateAsUpdate(doc);
        if (update.byteLength === 0) throw new Error('unexpected');
        durations.push(performance.now() - start);
      }

      const result = collect('Encode full state (10K lines)', 'large-doc', durations, 100, {
        lines: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(100);

      doc.destroy();
    });

    it('compute diff from empty state vector (10K-line doc) (p95 < 100ms)', () => {
      const durations: number[] = [];
      const doc = createDocWithLines(10_000);
      const emptyDoc = new Y.Doc();
      const emptySv = Y.encodeStateVector(emptyDoc);

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const diff = Y.encodeStateAsUpdate(doc, emptySv);
        if (diff.byteLength === 0) throw new Error('unexpected');
        durations.push(performance.now() - start);
      }

      const result = collect('Diff from empty SV (10K lines)', 'large-doc', durations, 100, {
        lines: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(100);

      doc.destroy();
      emptyDoc.destroy();
    });

    it('apply full state to new doc (10K-line doc) (p95 < 100ms)', () => {
      const durations: number[] = [];
      const sourceDoc = createDocWithLines(10_000);
      const fullState = Y.encodeStateAsUpdate(sourceDoc);

      for (let i = 0; i < ITERATIONS; i++) {
        const newDoc = new Y.Doc();
        const start = performance.now();
        Y.applyUpdate(newDoc, fullState);
        durations.push(performance.now() - start);
        newDoc.destroy();
      }

      const result = collect(
        'Apply full state to new doc (10K lines)',
        'large-doc',
        durations,
        100,
        { lines: 10_000, stateSizeBytes: fullState.byteLength },
      );
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(100);

      sourceDoc.destroy();
    });
  });

  // ─── Reconnection Scenario ───────────────────────────────────────────────

  describe('Reconnection with offline changes', () => {
    it('reconnect with 10 pending updates (p95 < 200ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const serverDoc = createDocWithLines(500);
        const serverState = Y.encodeStateAsUpdate(serverDoc);

        // Client goes offline, makes 10 edits
        const clientDoc = new Y.Doc();
        Y.applyUpdate(clientDoc, serverState);
        const offlineUpdates = simulateClientEdits(clientDoc, 10, 'offline');

        // Meanwhile, server gets edits from another user
        const otherDoc = new Y.Doc();
        Y.applyUpdate(otherDoc, serverState);
        const otherUpdates = simulateClientEdits(otherDoc, 5, 'other');
        for (const u of otherUpdates) {
          Y.applyUpdate(serverDoc, u);
        }

        // Reconnection: compute server diff and apply client updates
        const clientSv = Y.encodeStateVector(clientDoc);

        const start = performance.now();

        // 1. Server computes diff for client
        const serverDiff = Y.encodeStateAsUpdate(serverDoc, clientSv);

        // 2. Apply all client updates to server
        for (const u of offlineUpdates) {
          Y.applyUpdate(serverDoc, u);
        }

        // 3. Apply server diff to client
        Y.applyUpdate(clientDoc, serverDiff);

        durations.push(performance.now() - start);

        serverDoc.destroy();
        clientDoc.destroy();
        otherDoc.destroy();
      }

      const result = collect('Reconnect with 10 offline updates', 'reconnection', durations, 200, {
        pendingUpdates: 10,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(200);
    });

    it('reconnect with 100 pending updates (p95 < 200ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const serverDoc = createDocWithLines(500);
        const serverState = Y.encodeStateAsUpdate(serverDoc);

        const clientDoc = new Y.Doc();
        Y.applyUpdate(clientDoc, serverState);
        const offlineUpdates = simulateClientEdits(clientDoc, 100, 'offline');

        // Server gets concurrent edits
        const otherDoc = new Y.Doc();
        Y.applyUpdate(otherDoc, serverState);
        const otherUpdates = simulateClientEdits(otherDoc, 50, 'other');
        for (const u of otherUpdates) {
          Y.applyUpdate(serverDoc, u);
        }

        const clientSv = Y.encodeStateVector(clientDoc);

        const start = performance.now();

        const serverDiff = Y.encodeStateAsUpdate(serverDoc, clientSv);

        for (const u of offlineUpdates) {
          Y.applyUpdate(serverDoc, u);
        }

        Y.applyUpdate(clientDoc, serverDiff);

        durations.push(performance.now() - start);

        serverDoc.destroy();
        clientDoc.destroy();
        otherDoc.destroy();
      }

      const result = collect('Reconnect with 100 offline updates', 'reconnection', durations, 200, {
        pendingUpdates: 100,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(200);
    });
  });

  // ─── Update Propagation Latency ──────────────────────────────────────────

  describe('Update propagation latency', () => {
    it('encode + apply single keystroke update (p95 < 5ms)', () => {
      const durations: number[] = [];
      const baseDoc = createDocWithLines(1000);
      const baseState = Y.encodeStateAsUpdate(baseDoc);

      for (let i = 0; i < ITERATIONS; i++) {
        // Simulate: client types a single character
        const clientDoc = new Y.Doc();
        Y.applyUpdate(clientDoc, baseState);
        const beforeSv = Y.encodeStateVector(clientDoc);
        const ytext = clientDoc.getText('content');
        ytext.insert(ytext.length, 'x');
        const update = Y.encodeStateAsUpdate(clientDoc, beforeSv);

        // Measure: encode on client + apply on server + encode diff for broadcast
        const serverDoc = new Y.Doc();
        Y.applyUpdate(serverDoc, baseState);

        const start = performance.now();

        // Server receives and applies
        Y.applyUpdate(serverDoc, update);

        // Server encodes for broadcast to other clients
        const broadcastUpdate = Y.encodeStateAsUpdate(serverDoc, beforeSv);
        if (broadcastUpdate.byteLength === 0) throw new Error('unexpected');

        durations.push(performance.now() - start);

        clientDoc.destroy();
        serverDoc.destroy();
      }

      const result = collect('Single keystroke propagation', 'propagation', durations, 5, {
        docSize: '1000 lines',
        operation: 'single character insert',
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(5);

      baseDoc.destroy();
    });
  });

  // ─── Frontmatter Resolution ──────────────────────────────────────────────

  describe('Frontmatter resolution', () => {
    it('resolve 10 conflicting fields (p95 < 5ms)', () => {
      const durations: number[] = [];
      const baseTime = Date.now();

      for (let i = 0; i < ITERATIONS; i++) {
        const serverFm = createTimestampedFrontmatter(
          {
            title: `Server Title ${i}`,
            status: 'published',
            tags: ['server', 'tag'],
            priority: 'high',
            category: 'engineering',
            author: 'server-user',
            version: 1,
            language: 'en',
            template: 'default',
            color: '#ff0000',
          },
          'server-user',
          baseTime,
        );

        const clientFm = createTimestampedFrontmatter(
          {
            title: `Client Title ${i}`,
            status: 'draft',
            tags: ['client', 'tag'],
            priority: 'low',
            category: 'design',
            author: 'client-user',
            version: 2,
            language: 'de',
            template: 'blog',
            color: '#0000ff',
          },
          'client-user',
          baseTime + 1000, // Client is slightly ahead
        );

        const start = performance.now();
        const merged = resolveFrontmatterLWW(serverFm, clientFm);
        JSON.stringify(merged);
        durations.push(performance.now() - start);
      }

      const result = collect('Resolve 10 conflicting fields', 'frontmatter', durations, 5, {
        fieldCount: 10,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(5);
    });

    it('resolve 50 fields (mixed conflicts/no-conflicts) (p95 < 10ms)', () => {
      const durations: number[] = [];
      const baseTime = Date.now();

      for (let i = 0; i < ITERATIONS; i++) {
        const fields: Record<string, unknown> = {};
        for (let f = 0; f < 50; f++) {
          fields[`field_${f}`] = `value_${f}_iter_${i}`;
        }

        const serverFm = createTimestampedFrontmatter(fields, 'server', baseTime);

        // Client has a subset of different values
        const clientFields: Record<string, unknown> = {};
        for (let f = 0; f < 50; f++) {
          clientFields[`field_${f}`] = f % 3 === 0 ? `client_value_${f}` : fields[`field_${f}`];
        }
        const clientFm = createTimestampedFrontmatter(clientFields, 'client', baseTime + 500);

        const start = performance.now();
        const merged = resolveFrontmatterLWW(serverFm, clientFm);
        JSON.stringify(merged);
        durations.push(performance.now() - start);
      }

      const result = collect('Resolve 50 fields (mixed)', 'frontmatter', durations, 10, {
        fieldCount: 50,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(10);
    });
  });

  // ─── Persistence Serialisation ────────────────────────────────────────────

  describe('Persistence serialisation', () => {
    it('base64 encode/decode Yjs state (1K-line doc) (p95 < 50ms)', () => {
      const durations: number[] = [];
      const doc = createDocWithLines(1000);
      const state = Y.encodeStateAsUpdate(doc);

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        // Encode to base64 (for Valkey storage)
        const encoded = Buffer.from(state).toString('base64');

        // Decode from base64 (for restoration)
        const decoded = Buffer.from(encoded, 'base64');
        const restoredDoc = new Y.Doc();
        Y.applyUpdate(restoredDoc, new Uint8Array(decoded));

        durations.push(performance.now() - start);
        restoredDoc.destroy();
      }

      const result = collect('Base64 encode/decode (1K lines)', 'persistence', durations, 50, {
        lines: 1000,
        stateSizeBytes: state.byteLength,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);

      doc.destroy();
    });

    it('base64 encode/decode Yjs state (10K-line doc) (p95 < 200ms)', () => {
      const durations: number[] = [];
      const doc = createDocWithLines(10_000);
      const state = Y.encodeStateAsUpdate(doc);

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        const encoded = Buffer.from(state).toString('base64');
        const decoded = Buffer.from(encoded, 'base64');
        const restoredDoc = new Y.Doc();
        Y.applyUpdate(restoredDoc, new Uint8Array(decoded));

        durations.push(performance.now() - start);
        restoredDoc.destroy();
      }

      const result = collect('Base64 encode/decode (10K lines)', 'persistence', durations, 200, {
        lines: 10_000,
        stateSizeBytes: state.byteLength,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(200);

      doc.destroy();
    });
  });
});
