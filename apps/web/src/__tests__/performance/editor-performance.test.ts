/**
 * Editor Performance Benchmarks
 *
 * Measures the performance of the editor subsystem with large documents.
 * These tests run in a Node.js environment and exercise the data-layer
 * operations that drive editor responsiveness (Yjs updates, content parsing,
 * frontmatter processing) without requiring a browser DOM.
 *
 * For DOM-dependent benchmarks (actual CodeMirror rendering), see the
 * Playwright-based tests in the e2e suite.
 *
 * Performance budgets (p95):
 *   - Single keystroke Yjs update:      < 16ms  (60fps frame budget)
 *   - Open 10K-line doc (parse + load): < 1000ms
 *   - Frontmatter parse (large):        < 10ms
 *   - Content serialisation (10K):      < 50ms
 *   - Undo/redo operation:              < 16ms
 *
 * Results are emitted as JSON for CI regression tracking.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as Y from 'yjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditorBenchmarkResult {
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

interface EditorBenchmarkSuite {
  suite: string;
  environment: string;
  nodeVersion: string;
  results: EditorBenchmarkResult[];
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
): EditorBenchmarkResult {
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

/** Generate realistic markdown content of the given line count. */
function generateMarkdownContent(lineCount: number): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push('title: Performance Benchmark Document');
  lines.push('tags: [benchmark, performance, large-doc]');
  lines.push('status: draft');
  lines.push('created: 2026-01-15T10:00:00.000Z');
  lines.push('---');
  lines.push('');

  for (let i = 0; i < lineCount; i++) {
    if (i % 500 === 0) {
      lines.push(`# Chapter ${Math.floor(i / 500) + 1}`);
      lines.push('');
    } else if (i % 100 === 0) {
      lines.push(`## Section ${Math.floor(i / 100) + 1}`);
      lines.push('');
    } else if (i % 50 === 0) {
      lines.push(`### Subsection ${i}`);
      lines.push('');
    } else if (i % 20 === 0) {
      lines.push('```typescript');
      lines.push(`const value${i} = computeResult(${i});`);
      lines.push(`console.log('Result:', value${i});`);
      lines.push('```');
      lines.push('');
    } else if (i % 10 === 0) {
      lines.push(
        `> Blockquote: Important note at line ${i}. This contains **bold** and *italic* text.`,
      );
    } else if (i % 7 === 0) {
      lines.push(`- [ ] Task item ${i}: Complete performance testing for this section`);
    } else if (i % 5 === 0) {
      lines.push(`- List item ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`);
    } else if (i % 3 === 0) {
      lines.push(
        `Line ${i}: The [[Internal Link ${i}]] connects to another note. See also [external](https://example.com/${i}).`,
      );
    } else {
      lines.push(
        `Line ${i}: The quick brown fox jumps over the lazy dog. Performance benchmark content number ${i}.`,
      );
    }
  }

  return lines.join('\n');
}

/** Simple frontmatter parser (mirrors the app's frontmatter-parser.ts). */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const fmRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(fmRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const fmBlock = match[1];
  const body = content.slice(match[0].length);
  const frontmatter: Record<string, unknown> = {};

  for (const line of fmBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value: unknown = line.slice(colonIdx + 1).trim();

      // Simple array detection
      if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim());
      }

      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/** Create a Yjs doc from markdown content. */
function createYjsDocFromContent(content: string): Y.Doc {
  const doc = new Y.Doc();
  const ytext = doc.getText('content');
  ytext.insert(0, content);
  return doc;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITERATIONS = 100;
const suiteResults: EditorBenchmarkResult[] = [];

// ---------------------------------------------------------------------------
// Benchmark suite
// ---------------------------------------------------------------------------

describe('Editor Performance Benchmarks', () => {
  afterAll(() => {
    const suite: EditorBenchmarkSuite = {
      suite: 'editor-performance',
      environment: 'unit',
      nodeVersion: process.version,
      results: suiteResults,
      runDate: new Date().toISOString(),
    };

    console.log('\n--- BENCHMARK RESULTS (JSON) ---');
    console.log(JSON.stringify(suite, null, 2));
    console.log('--- END BENCHMARK RESULTS ---\n');
  });

  // ─── Document Opening ────────────────────────────────────────────────────

  describe('Document opening (parse + load)', () => {
    it('open 1K-line document (p95 < 200ms)', () => {
      const content = generateMarkdownContent(1000);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        // 1. Parse frontmatter
        const { frontmatter, body } = parseFrontmatter(content);

        // 2. Create Yjs document
        const doc = new Y.Doc();
        const ytext = doc.getText('content');
        ytext.insert(0, body);

        // 3. Encode state (for sync initialisation)
        const state = Y.encodeStateAsUpdate(doc);
        const _sv = Y.encodeStateVector(doc);

        // 4. Simulate initial render data preparation
        JSON.stringify({
          frontmatter,
          contentLength: body.length,
          stateSize: state.byteLength,
        });

        durations.push(performance.now() - start);
        doc.destroy();
      }

      const result = collect('Open 1K-line doc', 'document-open', durations, 200, {
        lines: 1000,
        contentBytes: content.length,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(200);
    });

    it('open 10K-line document (p95 < 1000ms)', () => {
      const content = generateMarkdownContent(10_000);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        const { frontmatter, body } = parseFrontmatter(content);

        const doc = new Y.Doc();
        const ytext = doc.getText('content');
        ytext.insert(0, body);

        const state = Y.encodeStateAsUpdate(doc);
        const _sv = Y.encodeStateVector(doc);

        JSON.stringify({
          frontmatter,
          contentLength: body.length,
          stateSize: state.byteLength,
        });

        durations.push(performance.now() - start);
        doc.destroy();
      }

      const result = collect('Open 10K-line doc', 'document-open', durations, 1000, {
        lines: 10_000,
        contentBytes: content.length,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(1000);
    });
  });

  // ─── Keystroke Performance ───────────────────────────────────────────────

  describe('Keystroke latency (Yjs update cycle)', () => {
    it('single character insert in 1K-line doc (p95 < 16ms)', () => {
      const content = generateMarkdownContent(1000);
      const doc = createYjsDocFromContent(content);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const ytext = doc.getText('content');
        const pos = Math.floor(Math.random() * ytext.length);
        const beforeSv = Y.encodeStateVector(doc);

        const start = performance.now();

        // 1. Insert character (simulates keystroke)
        ytext.insert(pos, 'x');

        // 2. Encode update for sync
        const update = Y.encodeStateAsUpdate(doc, beforeSv);

        // 3. Simulate broadcast serialisation
        const _serialised = Array.from(update);

        durations.push(performance.now() - start);
      }

      const result = collect('Single keystroke (1K doc)', 'keystroke', durations, 16, {
        lines: 1000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);

      doc.destroy();
    });

    it('single character insert in 10K-line doc (p95 < 16ms)', () => {
      const content = generateMarkdownContent(10_000);
      const doc = createYjsDocFromContent(content);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const ytext = doc.getText('content');
        const pos = Math.floor(Math.random() * ytext.length);
        const beforeSv = Y.encodeStateVector(doc);

        const start = performance.now();

        ytext.insert(pos, 'x');
        const update = Y.encodeStateAsUpdate(doc, beforeSv);
        const _serialised = Array.from(update);

        durations.push(performance.now() - start);
      }

      const result = collect('Single keystroke (10K doc)', 'keystroke', durations, 16, {
        lines: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);

      doc.destroy();
    });

    it('paste 100 characters in 10K-line doc (p95 < 16ms)', () => {
      const content = generateMarkdownContent(10_000);
      const doc = createYjsDocFromContent(content);
      const durations: number[] = [];
      const pasteText = 'A'.repeat(100);

      for (let i = 0; i < ITERATIONS; i++) {
        const ytext = doc.getText('content');
        const pos = Math.floor(Math.random() * ytext.length);
        const beforeSv = Y.encodeStateVector(doc);

        const start = performance.now();

        ytext.insert(pos, pasteText);
        const update = Y.encodeStateAsUpdate(doc, beforeSv);
        const _serialised = Array.from(update);

        durations.push(performance.now() - start);
      }

      const result = collect('Paste 100 chars (10K doc)', 'keystroke', durations, 16, {
        lines: 10_000,
        pasteLength: 100,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);

      doc.destroy();
    });

    it('delete selection (50 chars) in 10K-line doc (p95 < 16ms)', () => {
      const content = generateMarkdownContent(10_000);
      const doc = createYjsDocFromContent(content);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const ytext = doc.getText('content');
        const maxPos = Math.max(0, ytext.length - 50);
        const pos = Math.floor(Math.random() * maxPos);
        const beforeSv = Y.encodeStateVector(doc);

        const start = performance.now();

        ytext.delete(pos, 50);
        const update = Y.encodeStateAsUpdate(doc, beforeSv);
        const _serialised = Array.from(update);

        durations.push(performance.now() - start);

        // Re-insert to maintain document size
        ytext.insert(pos, 'R'.repeat(50));
      }

      const result = collect('Delete 50 chars (10K doc)', 'keystroke', durations, 16, {
        lines: 10_000,
        deleteLength: 50,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);

      doc.destroy();
    });
  });

  // ─── Undo / Redo ────────────────────────────────────────────────────────

  describe('Undo/Redo operations', () => {
    it('undo single operation in 10K-line doc (p95 < 16ms)', () => {
      const content = generateMarkdownContent(10_000);
      const doc = createYjsDocFromContent(content);
      const undoManager = new Y.UndoManager(doc.getText('content'));
      const ytext = doc.getText('content');
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        // Make an edit to undo
        const pos = Math.floor(Math.random() * ytext.length);
        ytext.insert(pos, `undo-test-${i}`);

        const start = performance.now();
        undoManager.undo();
        durations.push(performance.now() - start);
      }

      const result = collect('Undo single op (10K doc)', 'undo-redo', durations, 16, {
        lines: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);

      doc.destroy();
    });

    it('redo single operation in 10K-line doc (p95 < 16ms)', () => {
      const content = generateMarkdownContent(10_000);
      const doc = createYjsDocFromContent(content);
      const undoManager = new Y.UndoManager(doc.getText('content'));
      const ytext = doc.getText('content');
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const pos = Math.floor(Math.random() * ytext.length);
        ytext.insert(pos, `redo-test-${i}`);
        undoManager.undo();

        const start = performance.now();
        undoManager.redo();
        durations.push(performance.now() - start);
      }

      const result = collect('Redo single op (10K doc)', 'undo-redo', durations, 16, {
        lines: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);

      doc.destroy();
    });
  });

  // ─── Frontmatter Processing ──────────────────────────────────────────────

  describe('Frontmatter processing', () => {
    it('parse simple frontmatter (p95 < 5ms)', () => {
      const content = [
        '---',
        'title: My Note Title',
        'tags: [tag1, tag2, tag3]',
        'status: published',
        'created: 2026-01-15T10:00:00.000Z',
        '---',
        '',
        '# Content starts here',
        'Some body text.',
      ].join('\n');

      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const result = parseFrontmatter(content);
        JSON.stringify(result.frontmatter);
        durations.push(performance.now() - start);
      }

      const result = collect('Parse simple frontmatter', 'frontmatter', durations, 5, {
        fieldCount: 4,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(5);
    });

    it('parse large frontmatter (50 fields) (p95 < 10ms)', () => {
      const fmLines = ['---'];
      for (let f = 0; f < 50; f++) {
        if (f % 5 === 0) {
          fmLines.push(`field_${f}: [val1, val2, val3, val4, val5]`);
        } else {
          fmLines.push(`field_${f}: value_${f}_with_some_longer_text_content`);
        }
      }
      fmLines.push('---');
      fmLines.push('');
      fmLines.push('# Body content');

      const content = fmLines.join('\n');
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const result = parseFrontmatter(content);
        JSON.stringify(result.frontmatter);
        durations.push(performance.now() - start);
      }

      const result = collect('Parse large frontmatter (50 fields)', 'frontmatter', durations, 10, {
        fieldCount: 50,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(10);
    });
  });

  // ─── Content Serialisation ────────────────────────────────────────────────

  describe('Content serialisation', () => {
    it('serialise 1K-line doc to markdown string (p95 < 10ms)', () => {
      const content = generateMarkdownContent(1000);
      const doc = createYjsDocFromContent(content);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const text = doc.getText('content').toString();
        // Simulate adding frontmatter back
        const _output = `---\ntitle: Test\nstatus: draft\n---\n\n${text}`;
        durations.push(performance.now() - start);
      }

      const result = collect('Serialise 1K-line doc', 'serialisation', durations, 10, {
        lines: 1000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(10);

      doc.destroy();
    });

    it('serialise 10K-line doc to markdown string (p95 < 50ms)', () => {
      const content = generateMarkdownContent(10_000);
      const doc = createYjsDocFromContent(content);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const text = doc.getText('content').toString();
        const _output = `---\ntitle: Test\nstatus: draft\n---\n\n${text}`;
        durations.push(performance.now() - start);
      }

      const result = collect('Serialise 10K-line doc', 'serialisation', durations, 50, {
        lines: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);

      doc.destroy();
    });
  });

  // ─── Wikilink / Internal Link Extraction ──────────────────────────────────

  describe('Internal link extraction', () => {
    it('extract [[wikilinks]] from 10K-line doc (p95 < 50ms)', () => {
      const content = generateMarkdownContent(10_000);
      const durations: number[] = [];
      const wikilinkRegex = /\[\[([^\]]+)\]\]/g;

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        const links: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = wikilinkRegex.exec(content)) !== null) {
          links.push(match[1]);
        }
        wikilinkRegex.lastIndex = 0; // Reset for next iteration

        durations.push(performance.now() - start);
      }

      const result = collect('Extract wikilinks (10K lines)', 'link-extraction', durations, 50, {
        lines: 10_000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);
    });
  });
});
