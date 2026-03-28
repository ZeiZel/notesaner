/**
 * Search Response Benchmark
 *
 * Measures the performance of search operations against a simulated
 * vault of 10,000 notes. Tests cover:
 *   - Full-text search indexing
 *   - Query execution and ranking
 *   - Result grouping and display preparation
 *   - Tag-based filtering
 *
 * Performance budget: < 200ms for 10K note vault
 *
 * @module performance/search-benchmark
 */

import { describe, it, expect, afterAll } from 'vitest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchBenchmarkResult {
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

interface SearchBenchmarkSuite {
  suite: string;
  environment: string;
  nodeVersion: string;
  results: SearchBenchmarkResult[];
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
): SearchBenchmarkResult {
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
// Vault simulator
// ---------------------------------------------------------------------------

interface NoteIndex {
  id: string;
  title: string;
  path: string;
  tags: string[];
  content: string;
  updatedAt: string;
  wordCount: number;
}

/** Vocabulary pool for generating realistic note content. */
const VOCABULARY = [
  'architecture',
  'design',
  'pattern',
  'system',
  'component',
  'module',
  'interface',
  'abstract',
  'concrete',
  'implementation',
  'algorithm',
  'data',
  'structure',
  'performance',
  'benchmark',
  'optimization',
  'refactoring',
  'testing',
  'deployment',
  'pipeline',
  'integration',
  'continuous',
  'delivery',
  'monitoring',
  'logging',
  'debugging',
  'security',
  'authentication',
  'authorization',
  'encryption',
  'token',
  'database',
  'query',
  'index',
  'migration',
  'schema',
  'relation',
  'frontend',
  'backend',
  'middleware',
  'gateway',
  'proxy',
  'cache',
  'websocket',
  'realtime',
  'synchronization',
  'collaboration',
  'editor',
  'markdown',
  'parser',
  'renderer',
  'plugin',
  'extension',
  'api',
  'typescript',
  'javascript',
  'react',
  'nextjs',
  'nestjs',
  'prisma',
  'graphql',
  'rest',
  'grpc',
  'protobuf',
  'json',
  'yaml',
  'container',
  'docker',
  'kubernetes',
  'terraform',
  'ansible',
  'nginx',
  'project',
  'planning',
  'sprint',
  'backlog',
  'review',
  'retrospective',
];

const TAG_POOL = [
  'work',
  'personal',
  'research',
  'meeting-notes',
  'project-alpha',
  'project-beta',
  'ideas',
  'todo',
  'reference',
  'draft',
  'published',
  'archived',
  'urgent',
  'follow-up',
  'learning',
  'book-notes',
  'code-snippet',
  'howto',
  'troubleshooting',
  'decision',
];

const FOLDER_POOL = [
  'daily',
  'projects',
  'archive',
  'references',
  'meetings',
  'research',
  'personal',
  'work',
  'learning',
  'templates',
];

function generateVault(noteCount: number): NoteIndex[] {
  const vault: NoteIndex[] = [];

  for (let i = 0; i < noteCount; i++) {
    // Generate realistic content
    const contentWords: string[] = [];
    const wordCount = 50 + Math.floor(Math.random() * 500);
    for (let w = 0; w < wordCount; w++) {
      contentWords.push(VOCABULARY[Math.floor(Math.random() * VOCABULARY.length)]);
    }
    const content = contentWords.join(' ');

    // Assign tags
    const tagCount = 1 + Math.floor(Math.random() * 4);
    const tags: string[] = [];
    for (let t = 0; t < tagCount; t++) {
      tags.push(TAG_POOL[Math.floor(Math.random() * TAG_POOL.length)]);
    }

    // Build path
    const folder = FOLDER_POOL[Math.floor(Math.random() * FOLDER_POOL.length)];
    const subfolder =
      Math.random() > 0.5 ? `/${FOLDER_POOL[Math.floor(Math.random() * FOLDER_POOL.length)]}` : '';

    vault.push({
      id: `note-${i}`,
      title: `Note ${i}: ${contentWords.slice(0, 5).join(' ')}`,
      path: `${folder}${subfolder}/note-${i}.md`,
      tags: [...new Set(tags)],
      content,
      updatedAt: new Date(Date.now() - Math.floor(Math.random() * 365 * 86400000)).toISOString(),
      wordCount,
    });
  }

  return vault;
}

// ---------------------------------------------------------------------------
// Search engine simulator
// ---------------------------------------------------------------------------

/**
 * Simple inverted index for full-text search simulation.
 * In the real app this would be backed by PostgreSQL FTS or SQLite FTS5.
 */
class SearchIndex {
  private invertedIndex = new Map<string, Set<number>>();
  private notes: NoteIndex[];

  constructor(notes: NoteIndex[]) {
    this.notes = notes;
    this.buildIndex();
  }

  private buildIndex(): void {
    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      const text = `${note.title} ${note.content}`.toLowerCase();
      const words = text.split(/\s+/);

      for (const word of words) {
        const normalized = word.replace(/[^a-z0-9]/g, '');
        if (normalized.length < 2) continue;

        if (!this.invertedIndex.has(normalized)) {
          this.invertedIndex.set(normalized, new Set());
        }
        this.invertedIndex.get(normalized)!.add(i);
      }
    }
  }

  search(query: string, limit: number = 50): NoteIndex[] {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    if (terms.length === 0) return [];

    // Find notes matching all terms (AND semantics)
    let matchingIds: Set<number> | null = null;

    for (const term of terms) {
      const ids = this.invertedIndex.get(term) ?? new Set<number>();
      if (matchingIds === null) {
        matchingIds = new Set(ids);
      } else {
        // Intersect
        const intersection = new Set<number>();
        for (const id of matchingIds) {
          if (ids.has(id)) intersection.add(id);
        }
        matchingIds = intersection;
      }
    }

    if (!matchingIds || matchingIds.size === 0) return [];

    // Rank by term frequency (simplified TF scoring)
    const ranked = Array.from(matchingIds).map((idx) => {
      const note = this.notes[idx];
      const text = `${note.title} ${note.content}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        const regex = new RegExp(term, 'gi');
        const matches = text.match(regex);
        score += matches ? matches.length : 0;
      }
      return { note, score };
    });

    ranked.sort((a, b) => b.score - a.score);

    return ranked.slice(0, limit).map((r) => r.note);
  }

  searchByTag(tag: string): NoteIndex[] {
    return this.notes.filter((n) => n.tags.includes(tag));
  }

  searchByPath(pathPrefix: string): NoteIndex[] {
    return this.notes.filter((n) => n.path.startsWith(pathPrefix));
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITERATIONS = 50;
const suiteResults: SearchBenchmarkResult[] = [];

// Pre-generate vault to amortize setup cost
const VAULT_10K = generateVault(10_000);

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

describe('Search Response Benchmarks (10K vault)', () => {
  afterAll(() => {
    const suite: SearchBenchmarkSuite = {
      suite: 'search-benchmark',
      environment: 'unit',
      nodeVersion: process.version,
      results: suiteResults,
      runDate: new Date().toISOString(),
    };

    console.log('\n--- BENCHMARK RESULTS (JSON) ---');
    console.log(JSON.stringify(suite, null, 2));
    console.log('--- END BENCHMARK RESULTS ---\n');
  });

  describe('Index building', () => {
    it('build search index for 10K notes (p95 < 5000ms)', () => {
      const durations: number[] = [];

      // Index building is expensive; use fewer iterations
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const _index = new SearchIndex(VAULT_10K);
        durations.push(performance.now() - start);
      }

      const result = collect('Build search index (10K notes)', 'search-index', durations, 5000, {
        noteCount: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(5000);
    });
  });

  describe('Full-text search queries', () => {
    // Build index once for all query benchmarks
    const searchIndex = new SearchIndex(VAULT_10K);

    it('single-term search in 10K notes (p95 < 200ms)', () => {
      const durations: number[] = [];
      const queries = ['architecture', 'performance', 'testing', 'database', 'frontend'];

      for (let i = 0; i < ITERATIONS; i++) {
        const query = queries[i % queries.length];
        const start = performance.now();
        const results = searchIndex.search(query);
        // Simulate result rendering preparation
        JSON.stringify(
          results.slice(0, 20).map((r) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            snippet: r.content.slice(0, 150),
          })),
        );
        durations.push(performance.now() - start);
      }

      const result = collect('Single-term search (10K)', 'search-query', durations, 200, {
        noteCount: 10_000,
        queryType: 'single-term',
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(200);
    });

    it('multi-term search in 10K notes (p95 < 200ms)', () => {
      const durations: number[] = [];
      const queries = [
        'architecture design',
        'performance optimization benchmark',
        'database query index',
        'frontend component testing',
        'security authentication token',
      ];

      for (let i = 0; i < ITERATIONS; i++) {
        const query = queries[i % queries.length];
        const start = performance.now();
        const results = searchIndex.search(query);
        JSON.stringify(
          results.slice(0, 20).map((r) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            snippet: r.content.slice(0, 150),
          })),
        );
        durations.push(performance.now() - start);
      }

      const result = collect('Multi-term search (10K)', 'search-query', durations, 200, {
        noteCount: 10_000,
        queryType: 'multi-term',
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(200);
    });

    it('rare-term search in 10K notes (p95 < 200ms)', () => {
      const durations: number[] = [];
      // These terms are less likely to match many notes
      const queries = ['kubernetes terraform', 'grpc protobuf', 'graphql schema migration'];

      for (let i = 0; i < ITERATIONS; i++) {
        const query = queries[i % queries.length];
        const start = performance.now();
        const results = searchIndex.search(query);
        JSON.stringify(
          results.slice(0, 20).map((r) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            snippet: r.content.slice(0, 150),
          })),
        );
        durations.push(performance.now() - start);
      }

      const result = collect('Rare-term search (10K)', 'search-query', durations, 200, {
        noteCount: 10_000,
        queryType: 'rare-term',
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(200);
    });
  });

  describe('Tag-based search', () => {
    const searchIndex = new SearchIndex(VAULT_10K);

    it('filter by tag in 10K notes (p95 < 50ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const tag = TAG_POOL[i % TAG_POOL.length];
        const start = performance.now();
        const results = searchIndex.searchByTag(tag);
        JSON.stringify(
          results.slice(0, 50).map((r) => ({
            id: r.id,
            title: r.title,
          })),
        );
        durations.push(performance.now() - start);
      }

      const result = collect('Tag filter (10K)', 'search-filter', durations, 50, {
        noteCount: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);
    });
  });

  describe('Path-based search', () => {
    const searchIndex = new SearchIndex(VAULT_10K);

    it('filter by folder path in 10K notes (p95 < 50ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const folder = FOLDER_POOL[i % FOLDER_POOL.length];
        const start = performance.now();
        const results = searchIndex.searchByPath(folder);
        JSON.stringify(
          results.slice(0, 50).map((r) => ({
            id: r.id,
            title: r.title,
            path: r.path,
          })),
        );
        durations.push(performance.now() - start);
      }

      const result = collect('Path filter (10K)', 'search-filter', durations, 50, {
        noteCount: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);
    });
  });

  describe('Combined search + filter', () => {
    const searchIndex = new SearchIndex(VAULT_10K);

    it('search + tag filter combined (p95 < 200ms)', () => {
      const durations: number[] = [];
      const queries = ['architecture', 'performance', 'database', 'testing', 'security'];
      const tags = ['work', 'research', 'project-alpha', 'learning', 'reference'];

      for (let i = 0; i < ITERATIONS; i++) {
        const query = queries[i % queries.length];
        const tag = tags[i % tags.length];

        const start = performance.now();

        // Search then filter by tag
        const searchResults = searchIndex.search(query, 200);
        const filtered = searchResults.filter((r) => r.tags.includes(tag));

        // Sort by date
        filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        // Prepare display
        JSON.stringify(
          filtered.slice(0, 20).map((r) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            tags: r.tags,
            snippet: r.content.slice(0, 150),
            updatedAt: r.updatedAt,
          })),
        );

        durations.push(performance.now() - start);
      }

      const result = collect('Search + tag filter (10K)', 'search-combined', durations, 200, {
        noteCount: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(200);
    });
  });
});
