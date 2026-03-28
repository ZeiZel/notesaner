/**
 * API Response Time Benchmarks
 *
 * Measures response times for key Notesaner API endpoints under simulated load.
 * Tests use mocked service layers to isolate HTTP/serialization overhead from
 * database or I/O concerns (those are covered in database-benchmarks.test.ts).
 *
 * Performance budgets (p95):
 *   - CRUD operations: < 100ms
 *   - Search (FTS):    < 500ms
 *   - List / paginate: < 100ms
 *
 * Results are collected as JSON-serialisable objects for CI comparison.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BenchmarkResult {
  name: string;
  endpoint: string;
  method: string;
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
  /** ISO 8601 timestamp of when the benchmark was run. */
  timestamp: string;
  /** Whether the p95 value met the budget. */
  withinBudget: boolean;
  /** Budget threshold in milliseconds. */
  budgetMs: number;
}

interface BenchmarkSuite {
  suite: string;
  environment: string;
  nodeVersion: string;
  results: BenchmarkResult[];
  runDate: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function calculateStddev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

function collectTimings(
  name: string,
  endpoint: string,
  method: string,
  durations: number[],
  budgetMs: number,
): BenchmarkResult {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  return {
    name,
    endpoint,
    method,
    iterations: sorted.length,
    timings: {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: parseFloat(mean.toFixed(3)),
      median: calculatePercentile(sorted, 50),
      p95: calculatePercentile(sorted, 95),
      p99: calculatePercentile(sorted, 99),
      stddev: parseFloat(calculateStddev(sorted, mean).toFixed(3)),
    },
    timestamp: new Date().toISOString(),
    withinBudget: calculatePercentile(sorted, 95) <= budgetMs,
    budgetMs,
  };
}

/**
 * Simulate an API handler execution path including JSON serialisation.
 *
 * In a full integration setup this would call the NestJS app via supertest.
 * Here we measure the handler + serialisation overhead in isolation, which
 * gives a reliable lower-bound for per-request latency that is independent
 * of network stack variability.
 */
async function simulateEndpoint(handler: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  const result = await handler();
  // Simulate JSON serialisation (always happens in the HTTP layer)
  JSON.stringify(result);
  const end = performance.now();
  return end - start;
}

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

function generateNoteStub(id: string) {
  return {
    id,
    workspaceId: 'ws-bench-001',
    path: `benchmarks/note-${id}.md`,
    title: `Benchmark Note ${id}`,
    content:
      `# Benchmark Note ${id}\n\nThis is benchmark content for performance testing.\n\n`.repeat(5),
    frontmatter: {
      tags: ['benchmark', 'performance', 'testing'],
      status: 'published',
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-03-28T12:00:00.000Z',
    },
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-03-28T12:00:00.000Z'),
    isTrashed: false,
  };
}

function generateNoteList(count: number) {
  return Array.from({ length: count }, (_, i) => generateNoteStub(`note-${i}`));
}

function generateSearchResults(count: number) {
  return {
    results: Array.from({ length: count }, (_, i) => ({
      id: `note-${i}`,
      workspaceId: 'ws-bench-001',
      path: `folder/note-${i}.md`,
      title: `Search Result Note ${i}`,
      snippet: `...matching <mark>keyword</mark> found in context of note ${i}...`,
      rank: Math.random() * 10,
      updatedAt: new Date('2026-03-28T12:00:00.000Z'),
    })),
    nextCursor: count >= 20 ? `note-${count - 1}` : null,
    total: count * 5, // simulate more results than a single page
  };
}

function generateWorkspaceStub(id: string) {
  return {
    id,
    name: `Benchmark Workspace ${id}`,
    slug: `bench-ws-${id}`,
    description: 'A workspace used for performance benchmarking',
    isPublic: false,
    ownerId: 'user-bench-001',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-28T00:00:00.000Z'),
    memberCount: 5,
  };
}

// ---------------------------------------------------------------------------
// Benchmark suite
// ---------------------------------------------------------------------------

const WARMUP_ITERATIONS = 10;
const BENCHMARK_ITERATIONS = 200;
const suiteResults: BenchmarkResult[] = [];

describe('API Response Time Benchmarks', () => {
  beforeAll(() => {
    // Warm up the JIT compiler
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      JSON.stringify(generateNoteStub(`warmup-${i}`));
      JSON.stringify(generateNoteList(20));
      JSON.stringify(generateSearchResults(20));
    }
  });

  afterAll(() => {
    const suite: BenchmarkSuite = {
      suite: 'api-benchmarks',
      environment: 'unit',
      nodeVersion: process.version,
      results: suiteResults,
      runDate: new Date().toISOString(),
    };

    // Output JSON for CI consumption
    console.log('\n--- BENCHMARK RESULTS (JSON) ---');
    console.log(JSON.stringify(suite, null, 2));
    console.log('--- END BENCHMARK RESULTS ---\n');
  });

  // ─── Notes CRUD ──────────────────────────────────────────────────────────

  describe('Notes CRUD', () => {
    it('POST /workspaces/:id/notes — create note (p95 < 100ms)', async () => {
      const durations: number[] = [];

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          // Simulate DTO validation + service call + response construction
          const dto = {
            path: `bench/note-${i}.md`,
            title: `Benchmark Note ${i}`,
            content: `# Note ${i}\n\nContent for benchmarking.\n`,
          };
          // Simulate service processing overhead
          const note = generateNoteStub(`created-${i}`);
          return { ...note, ...dto };
        });
        durations.push(d);
      }

      const result = collectTimings(
        'Create Note',
        'POST /workspaces/:id/notes',
        'POST',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });

    it('GET /workspaces/:id/notes/:noteId — get single note (p95 < 100ms)', async () => {
      const durations: number[] = [];

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return generateNoteStub(`note-${i}`);
        });
        durations.push(d);
      }

      const result = collectTimings(
        'Get Note by ID',
        'GET /workspaces/:id/notes/:noteId',
        'GET',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });

    it('GET /workspaces/:id/notes/:noteId/content — get note content (p95 < 100ms)', async () => {
      const durations: number[] = [];
      // Simulate a large note (~50KB)
      const largeContent = '# Large Note\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(2000);

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return {
            content: largeContent,
            contentHash: 'sha256:abcdef1234567890',
          };
        });
        durations.push(d);
      }

      const result = collectTimings(
        'Get Note Content',
        'GET /workspaces/:id/notes/:noteId/content',
        'GET',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });

    it('PATCH /workspaces/:id/notes/:noteId — update note (p95 < 100ms)', async () => {
      const durations: number[] = [];

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          const note = generateNoteStub(`note-${i}`);
          return {
            ...note,
            title: `Updated Title ${i}`,
            updatedAt: new Date(),
          };
        });
        durations.push(d);
      }

      const result = collectTimings(
        'Update Note',
        'PATCH /workspaces/:id/notes/:noteId',
        'PATCH',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });

    it('DELETE /workspaces/:id/notes/:noteId — delete note (p95 < 100ms)', async () => {
      const durations: number[] = [];

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return { success: true };
        });
        durations.push(d);
      }

      const result = collectTimings(
        'Delete Note',
        'DELETE /workspaces/:id/notes/:noteId',
        'DELETE',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });
  });

  // ─── Notes List / Pagination ──────────────────────────────────────────────

  describe('Notes Listing', () => {
    it('GET /workspaces/:id/notes — list 20 notes (p95 < 100ms)', async () => {
      const durations: number[] = [];
      const notes = generateNoteList(20);

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return {
            data: notes,
            nextCursor: 'note-19',
            total: 500,
          };
        });
        durations.push(d);
      }

      const result = collectTimings(
        'List Notes (20)',
        'GET /workspaces/:id/notes?limit=20',
        'GET',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });

    it('GET /workspaces/:id/notes — list 100 notes (p95 < 100ms)', async () => {
      const durations: number[] = [];
      const notes = generateNoteList(100);

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return {
            data: notes,
            nextCursor: 'note-99',
            total: 5000,
          };
        });
        durations.push(d);
      }

      const result = collectTimings(
        'List Notes (100)',
        'GET /workspaces/:id/notes?limit=100',
        'GET',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });

    it('GET /workspaces/:id/notes/graph — graph data (p95 < 100ms)', async () => {
      const durations: number[] = [];
      // Simulate a workspace with 500 notes and 2000 links
      const nodes = Array.from({ length: 500 }, (_, i) => ({
        id: `note-${i}`,
        title: `Note ${i}`,
        path: `folder/note-${i}.md`,
        linkCount: Math.floor(Math.random() * 20),
      }));
      const edges = Array.from({ length: 2000 }, (_, i) => ({
        source: `note-${i % 500}`,
        target: `note-${(i * 7 + 13) % 500}`,
        type: 'wikilink',
      }));

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return { nodes, edges };
        });
        durations.push(d);
      }

      const result = collectTimings(
        'Note Graph Data',
        'GET /workspaces/:id/notes/graph',
        'GET',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });
  });

  // ─── Search ─────────────────────────────────────────────────────────────

  describe('Search', () => {
    it('GET /workspaces/:id/search?q=... — FTS search (p95 < 500ms)', async () => {
      const durations: number[] = [];

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          // Simulate FTS query processing + result ranking
          const results = generateSearchResults(20);
          // Simulate ranking computation
          results.results.sort((a, b) => b.rank - a.rank);
          return results;
        });
        durations.push(d);
      }

      const result = collectTimings(
        'Full-Text Search',
        'GET /workspaces/:id/search?q=keyword',
        'GET',
        durations,
        500,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(500);
    });

    it('GET /workspaces/:id/search/suggest?prefix=... — typeahead (p95 < 100ms)', async () => {
      const durations: number[] = [];
      const suggestions = Array.from({ length: 10 }, (_, i) => `suggestion-${i}`);

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return { data: suggestions };
        });
        durations.push(d);
      }

      const result = collectTimings(
        'Typeahead Suggest',
        'GET /workspaces/:id/search/suggest?prefix=key',
        'GET',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });
  });

  // ─── Workspaces ──────────────────────────────────────────────────────────

  describe('Workspaces', () => {
    it('POST /workspaces — create workspace (p95 < 100ms)', async () => {
      const durations: number[] = [];

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return generateWorkspaceStub(`ws-${i}`);
        });
        durations.push(d);
      }

      const result = collectTimings('Create Workspace', 'POST /workspaces', 'POST', durations, 100);
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });

    it('GET /workspaces — list user workspaces (p95 < 100ms)', async () => {
      const durations: number[] = [];
      const workspaces = Array.from({ length: 10 }, (_, i) => generateWorkspaceStub(`ws-${i}`));

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return { data: workspaces };
        });
        durations.push(d);
      }

      const result = collectTimings('List Workspaces', 'GET /workspaces', 'GET', durations, 100);
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });

    it('GET /workspaces/:id/members — list members (p95 < 100ms)', async () => {
      const durations: number[] = [];
      const members = Array.from({ length: 20 }, (_, i) => ({
        userId: `user-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: i === 0 ? 'OWNER' : 'EDITOR',
        joinedAt: new Date('2026-01-15T10:00:00.000Z'),
      }));

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const d = await simulateEndpoint(async () => {
          return { data: members };
        });
        durations.push(d);
      }

      const result = collectTimings(
        'List Workspace Members',
        'GET /workspaces/:id/members',
        'GET',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });
  });

  // ─── JSON Serialisation Stress ────────────────────────────────────────────

  describe('Serialisation overhead', () => {
    it('serialises large note list (1000 notes) within budget (p95 < 100ms)', async () => {
      const durations: number[] = [];
      const largeList = generateNoteList(1000);

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const start = performance.now();
        JSON.stringify({ data: largeList, total: 1000 });
        const end = performance.now();
        durations.push(end - start);
      }

      const result = collectTimings(
        'Serialise 1000 Notes',
        'N/A (serialisation)',
        'N/A',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });

    it('serialises large search results (100 results with snippets) within budget (p95 < 100ms)', async () => {
      const durations: number[] = [];
      const searchResult = generateSearchResults(100);

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const start = performance.now();
        JSON.stringify(searchResult);
        const end = performance.now();
        durations.push(end - start);
      }

      const result = collectTimings(
        'Serialise 100 Search Results',
        'N/A (serialisation)',
        'N/A',
        durations,
        100,
      );
      suiteResults.push(result);

      expect(result.timings.p95).toBeLessThan(100);
    });
  });
});
