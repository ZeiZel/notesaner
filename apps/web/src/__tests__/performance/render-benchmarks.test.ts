/**
 * Component Render Time Benchmarks
 *
 * Measures the CPU cost of component data preparation and state operations
 * that drive render performance. Since these tests run in a Node.js
 * environment (Vitest), they exercise the non-DOM parts of the rendering
 * pipeline: store updates, derived state computation, props assembly, and
 * virtual-DOM-like diffing heuristics.
 *
 * For actual browser render measurements, use Lighthouse CI or Playwright
 * performance tracing.
 *
 * Performance budgets (p95):
 *   - Note list store update (100 items):   < 16ms
 *   - Note list store update (1000 items):  < 50ms
 *   - Editor state preparation:             < 16ms
 *   - Sidebar tree build (500 nodes):       < 16ms
 *   - Search results processing:            < 16ms
 *   - Workspace state hydration:            < 10ms
 *
 * Results are emitted as JSON for CI regression tracking.
 */

import { describe, it, expect, afterAll } from 'vitest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RenderBenchmarkResult {
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

interface RenderBenchmarkSuite {
  suite: string;
  environment: string;
  nodeVersion: string;
  results: RenderBenchmarkResult[];
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
): RenderBenchmarkResult {
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
// Mock data generators
// ---------------------------------------------------------------------------

interface NoteListItem {
  id: string;
  title: string;
  path: string;
  updatedAt: string;
  tags: string[];
  isTrashed: boolean;
  excerpt: string;
}

interface SidebarTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'note';
  path: string;
  children: SidebarTreeNode[];
  depth: number;
  isExpanded: boolean;
}

interface SearchResultItem {
  id: string;
  title: string;
  path: string;
  snippet: string;
  rank: number;
  tags: string[];
  updatedAt: string;
}

function generateNoteListItems(count: number): NoteListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `note-${i}`,
    title: `Note ${i}: Performance testing document with a medium-length title`,
    path: `folder-${i % 20}/subfolder-${i % 5}/note-${i}.md`,
    updatedAt: new Date(Date.now() - i * 3600_000).toISOString(),
    tags: [`tag-${i % 10}`, `category-${i % 5}`, i % 3 === 0 ? 'important' : 'normal'],
    isTrashed: false,
    excerpt: `This is an excerpt from note ${i}. It contains some preview text that would be shown in the list view.`,
  }));
}

function generateSidebarTree(depth: number, breadth: number, currentDepth = 0): SidebarTreeNode[] {
  if (currentDepth >= depth) return [];

  return Array.from({ length: breadth }, (_, i) => {
    const isFolder = currentDepth < depth - 1;
    const node: SidebarTreeNode = {
      id: `node-${currentDepth}-${i}`,
      name: isFolder ? `Folder ${currentDepth}-${i}` : `Note ${currentDepth}-${i}.md`,
      type: isFolder ? 'folder' : 'note',
      path: `${'folder/'.repeat(currentDepth)}${isFolder ? `folder-${i}` : `note-${i}.md`}`,
      children: isFolder ? generateSidebarTree(depth, breadth, currentDepth + 1) : [],
      depth: currentDepth,
      isExpanded: currentDepth < 2,
    };
    return node;
  });
}

function generateSearchResults(count: number): SearchResultItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `result-${i}`,
    title: `Search Result ${i}: Document about performance testing and benchmarking`,
    path: `folder/note-${i}.md`,
    snippet: `...before <mark>search term</mark> after context in document ${i}...`,
    rank: Math.random() * 10,
    tags: [`tag-${i % 8}`],
    updatedAt: new Date(Date.now() - i * 7200_000).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Simulated store operations
// ---------------------------------------------------------------------------

/**
 * Simulates a Zustand-style store update for a note list.
 * This exercises the main computation path in a typical store selector.
 */
function simulateNoteListStoreUpdate(
  items: NoteListItem[],
  sortBy: 'title' | 'updatedAt' | 'path',
  filterTag: string | null,
  searchQuery: string | null,
) {
  let result = [...items];

  // Filter by tag
  if (filterTag) {
    result = result.filter((n) => n.tags.includes(filterTag));
  }

  // Filter by search query
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q) ||
        n.path.toLowerCase().includes(q),
    );
  }

  // Sort
  switch (sortBy) {
    case 'title':
      result.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'updatedAt':
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    case 'path':
      result.sort((a, b) => a.path.localeCompare(b.path));
      break;
  }

  return result;
}

/**
 * Simulates building a flat list from the sidebar tree (for virtualised rendering).
 */
function flattenSidebarTree(nodes: SidebarTreeNode[]): SidebarTreeNode[] {
  const result: SidebarTreeNode[] = [];

  function walk(items: SidebarTreeNode[]) {
    for (const node of items) {
      result.push(node);
      if (node.type === 'folder' && node.isExpanded) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return result;
}

/**
 * Simulates computing search result highlights and grouping.
 */
function processSearchResults(results: SearchResultItem[]) {
  // Sort by rank
  const sorted = [...results].sort((a, b) => b.rank - a.rank);

  // Group by folder
  const grouped = new Map<string, SearchResultItem[]>();
  for (const item of sorted) {
    const folder = item.path.split('/').slice(0, -1).join('/') || '/';
    const existing = grouped.get(folder) ?? [];
    existing.push(item);
    grouped.set(folder, existing);
  }

  // Compute per-group metadata
  const groups = Array.from(grouped.entries()).map(([folder, items]) => ({
    folder,
    items,
    count: items.length,
    topRank: Math.max(...items.map((i) => i.rank)),
  }));

  return { sorted, groups, total: results.length };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITERATIONS = 200;
const suiteResults: RenderBenchmarkResult[] = [];

// ---------------------------------------------------------------------------
// Benchmark suite
// ---------------------------------------------------------------------------

describe('Component Render Benchmarks', () => {
  afterAll(() => {
    const suite: RenderBenchmarkSuite = {
      suite: 'render-benchmarks',
      environment: 'unit',
      nodeVersion: process.version,
      results: suiteResults,
      runDate: new Date().toISOString(),
    };

    console.log('\n--- BENCHMARK RESULTS (JSON) ---');
    console.log(JSON.stringify(suite, null, 2));
    console.log('--- END BENCHMARK RESULTS ---\n');
  });

  // ─── Note List ──────────────────────────────────────────────────────────

  describe('Note list store operations', () => {
    it('update + sort + filter 100 notes (p95 < 16ms)', () => {
      const items = generateNoteListItems(100);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const result = simulateNoteListStoreUpdate(items, 'updatedAt', 'tag-3', null);
        JSON.stringify(result.slice(0, 20)); // Simulate rendering first page
        durations.push(performance.now() - start);
      }

      const result = collect('Note list update (100 items)', 'note-list', durations, 16, {
        itemCount: 100,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);
    });

    it('update + sort + filter 1000 notes (p95 < 50ms)', () => {
      const items = generateNoteListItems(1000);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const result = simulateNoteListStoreUpdate(items, 'title', 'tag-5', null);
        JSON.stringify(result.slice(0, 20));
        durations.push(performance.now() - start);
      }

      const result = collect('Note list update (1000 items)', 'note-list', durations, 50, {
        itemCount: 1000,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);
    });

    it('update + sort + search 1000 notes (p95 < 50ms)', () => {
      const items = generateNoteListItems(1000);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const result = simulateNoteListStoreUpdate(items, 'updatedAt', null, 'performance');
        JSON.stringify(result.slice(0, 20));
        durations.push(performance.now() - start);
      }

      const result = collect('Note list search (1000 items)', 'note-list', durations, 50, {
        itemCount: 1000,
        hasSearchQuery: true,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(50);
    });
  });

  // ─── Sidebar Tree ───────────────────────────────────────────────────────

  describe('Sidebar tree operations', () => {
    it('flatten sidebar tree (500 nodes, 4 levels) (p95 < 16ms)', () => {
      // 4 levels x ~5 breadth = ~500 nodes
      const tree = generateSidebarTree(4, 5);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const flat = flattenSidebarTree(tree);
        // Simulate render preparation
        flat.map((n) => ({
          key: n.id,
          label: n.name,
          indent: n.depth * 16,
          icon: n.type === 'folder' ? 'folder' : 'file',
        }));
        durations.push(performance.now() - start);
      }

      const result = collect('Flatten sidebar tree (500 nodes)', 'sidebar', durations, 16, {
        nodeCount: 500,
        depth: 4,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);
    });

    it('toggle expand/collapse + re-flatten (p95 < 16ms)', () => {
      const tree = generateSidebarTree(4, 5);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        // Toggle a node's expanded state (simulate user clicking)
        const targetPath = `folder/folder-${i % 5}`;
        function toggleNode(nodes: SidebarTreeNode[]): SidebarTreeNode[] {
          return nodes.map((n) => {
            if (n.path === targetPath) {
              return { ...n, isExpanded: !n.isExpanded };
            }
            if (n.children.length > 0) {
              return { ...n, children: toggleNode(n.children) };
            }
            return n;
          });
        }

        const updatedTree = toggleNode(tree);
        flattenSidebarTree(updatedTree);

        durations.push(performance.now() - start);
      }

      const result = collect('Toggle + re-flatten sidebar', 'sidebar', durations, 16, {});
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);
    });
  });

  // ─── Search Results ─────────────────────────────────────────────────────

  describe('Search results processing', () => {
    it('process + group 20 search results (p95 < 16ms)', () => {
      const results = generateSearchResults(20);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const processed = processSearchResults(results);
        JSON.stringify(processed);
        durations.push(performance.now() - start);
      }

      const result = collect('Process search results (20)', 'search', durations, 16, {
        resultCount: 20,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);
    });

    it('process + group 100 search results (p95 < 16ms)', () => {
      const results = generateSearchResults(100);
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const processed = processSearchResults(results);
        JSON.stringify(processed);
        durations.push(performance.now() - start);
      }

      const result = collect('Process search results (100)', 'search', durations, 16, {
        resultCount: 100,
      });
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);
    });
  });

  // ─── Editor State Preparation ──────────────────────────────────────────

  describe('Editor state preparation', () => {
    it('prepare editor props from store (p95 < 16ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        // Simulate: deriving editor props from global store
        const note = {
          id: `note-${i}`,
          title: `Editor Note ${i}`,
          path: `folder/note-${i}.md`,
          content: `# Note ${i}\n\n${'Line of content for the editor. '.repeat(20)}`,
          frontmatter: {
            tags: ['tag1', 'tag2'],
            status: 'draft',
            created: '2026-01-15T10:00:00.000Z',
            modified: '2026-03-28T12:00:00.000Z',
          },
          collaborators: Array.from({ length: 3 }, (_, j) => ({
            userId: `user-${j}`,
            name: `User ${j}`,
            color: `#${(j * 111111).toString(16).padStart(6, '0')}`,
            cursor: { line: j * 10, ch: j * 5 },
          })),
        };

        // Simulate: compute derived editor state
        const editorState = {
          noteId: note.id,
          initialContent: note.content,
          mode: 'source' as const,
          readOnly: false,
          frontmatter: note.frontmatter,
          collaboratorCount: note.collaborators.length,
          collaboratorColors: note.collaborators.map((c) => c.color),
          hasUnsavedChanges: false,
          wordCount: note.content.split(/\s+/).length,
          charCount: note.content.length,
          lineCount: note.content.split('\n').length,
        };

        JSON.stringify(editorState);

        durations.push(performance.now() - start);
      }

      const result = collect('Prepare editor props', 'editor', durations, 16, {});
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);
    });
  });

  // ─── Workspace State Hydration ──────────────────────────────────────────

  describe('Workspace state hydration', () => {
    it('hydrate workspace state from API response (p95 < 10ms)', () => {
      const durations: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        // Simulate: parsing a full workspace API response
        const apiResponse = {
          workspace: {
            id: `ws-${i}`,
            name: `Workspace ${i}`,
            slug: `workspace-${i}`,
            description: 'A workspace for testing',
            members: Array.from({ length: 10 }, (_, j) => ({
              userId: `user-${j}`,
              email: `user${j}@example.com`,
              role: j === 0 ? 'OWNER' : 'EDITOR',
            })),
            settings: {
              defaultNoteTemplate: 'blank',
              sidebarCollapsed: false,
              theme: 'auto',
              fontSize: 14,
              lineHeight: 1.6,
              enabledPlugins: ['backlinks', 'graph', 'daily-notes', 'templates'],
            },
          },
          recentNotes: Array.from({ length: 10 }, (_, j) => ({
            id: `note-${j}`,
            title: `Recent Note ${j}`,
            path: `folder/note-${j}.md`,
            updatedAt: new Date(Date.now() - j * 3600_000).toISOString(),
          })),
          pinnedNotes: Array.from({ length: 5 }, (_, j) => ({
            id: `pinned-${j}`,
            title: `Pinned Note ${j}`,
          })),
        };

        // Simulate: store hydration
        const _workspaceState = {
          id: apiResponse.workspace.id,
          name: apiResponse.workspace.name,
          slug: apiResponse.workspace.slug,
          memberCount: apiResponse.workspace.members.length,
          currentUserRole: apiResponse.workspace.members[0].role,
          settings: apiResponse.workspace.settings,
          recentNoteIds: apiResponse.recentNotes.map((n) => n.id),
          pinnedNoteIds: apiResponse.pinnedNotes.map((n) => n.id),
          isLoaded: true,
        };

        JSON.stringify(_workspaceState);

        durations.push(performance.now() - start);
      }

      const result = collect('Hydrate workspace state', 'workspace', durations, 10, {});
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(10);
    });
  });

  // ─── List Virtualisation Prep ──────────────────────────────────────────

  describe('List virtualisation preparation', () => {
    it('compute visible window for 5000-item list (p95 < 16ms)', () => {
      const items = generateNoteListItems(5000);
      const durations: number[] = [];
      const itemHeight = 64; // px
      const viewportHeight = 800; // px

      for (let i = 0; i < ITERATIONS; i++) {
        const scrollTop = Math.floor(Math.random() * items.length * itemHeight);

        const start = performance.now();

        // Simulate: virtualised list computation
        const overscan = 5;
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const endIndex = Math.min(
          items.length - 1,
          Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan,
        );

        const visibleItems = items.slice(startIndex, endIndex + 1).map((item, idx) => ({
          ...item,
          style: {
            position: 'absolute' as const,
            top: (startIndex + idx) * itemHeight,
            height: itemHeight,
          },
        }));

        const totalHeight = items.length * itemHeight;

        JSON.stringify({
          visibleItems: visibleItems.length,
          totalHeight,
          startIndex,
          endIndex,
        });

        durations.push(performance.now() - start);
      }

      const result = collect(
        'Virtualised list window (5000 items)',
        'virtualisation',
        durations,
        16,
        { totalItems: 5000, viewportHeight: 800, itemHeight: 64 },
      );
      suiteResults.push(result);
      expect(result.timings.p95).toBeLessThan(16);
    });
  });
});
