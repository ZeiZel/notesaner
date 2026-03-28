/**
 * Tests for graph-filter-utils.ts
 *
 * Covers all pure filter functions:
 * - matchesSearchQuery
 * - matchesTags
 * - matchesFolder
 * - matchesDateRange
 * - matchesOrphanFilter
 * - matchesLinkType
 * - linkEndpointsVisible
 * - filterNodes (composite)
 * - isSearchHighlighted
 * - extractAllTags
 * - buildTagCounts
 * - extractAllFolders
 */

import { describe, it, expect } from 'vitest';
import {
  matchesSearchQuery,
  matchesTags,
  matchesFolder,
  matchesDateRange,
  matchesOrphanFilter,
  matchesLinkType,
  linkEndpointsVisible,
  filterNodes,
  isSearchHighlighted,
  extractAllTags,
  buildTagCounts,
  extractAllFolders,
} from '../graph-filter-utils';
import type { D3GraphNode, D3GraphLink } from '../graph-data';
import type { GraphFilterState } from '../graph-filter-store';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

type TestNode = D3GraphNode & { createdAt?: string };

function makeNode(overrides: Partial<TestNode> & { id: string }): TestNode {
  return {
    title: `Note ${overrides.id}`,
    path: `notes/${overrides.id}.md`,
    tags: [],
    connectionCount: 1,
    radius: 6,
    color: '#6366f1',
    folder: 'notes',
    ...overrides,
  };
}

function makeLink(
  sourceId: string,
  targetId: string,
  linkType: D3GraphLink['linkType'] = 'WIKI',
): D3GraphLink {
  return {
    source: sourceId,
    target: targetId,
    linkType,
    relationshipTypeSlug: null,
    relationshipTypeColor: null,
  };
}

const DEFAULT_FILTERS: GraphFilterState = {
  searchQuery: '',
  selectedTags: [],
  selectedFolders: [],
  dateRange: { from: null, to: null },
  selectedLinkTypes: [],
  showOrphans: true,
};

// ---------------------------------------------------------------------------
// matchesSearchQuery
// ---------------------------------------------------------------------------

describe('matchesSearchQuery', () => {
  const node = makeNode({
    id: 'n1',
    title: 'React Architecture Guide',
    path: 'docs/react-arch.md',
  });

  it('returns true for an empty query', () => {
    expect(matchesSearchQuery(node, '')).toBe(true);
    expect(matchesSearchQuery(node, '   ')).toBe(true);
  });

  it('matches a substring of the title (case-insensitive)', () => {
    expect(matchesSearchQuery(node, 'react')).toBe(true);
    expect(matchesSearchQuery(node, 'REACT')).toBe(true);
    expect(matchesSearchQuery(node, 'Architecture')).toBe(true);
  });

  it('matches a substring of the path', () => {
    expect(matchesSearchQuery(node, 'docs')).toBe(true);
    expect(matchesSearchQuery(node, 'react-arch')).toBe(true);
  });

  it('returns false when the query does not match title or path', () => {
    expect(matchesSearchQuery(node, 'angular')).toBe(false);
    expect(matchesSearchQuery(node, 'unknown-folder')).toBe(false);
  });

  it('handles multi-word queries (full substring match)', () => {
    expect(matchesSearchQuery(node, 'react architecture')).toBe(true);
    expect(matchesSearchQuery(node, 'react angular')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// matchesTags
// ---------------------------------------------------------------------------

describe('matchesTags', () => {
  const node = makeNode({ id: 'n1', tags: ['typescript', 'react', 'frontend'] });

  it('returns true when selectedTags is empty', () => {
    expect(matchesTags(node, [])).toBe(true);
  });

  it('returns true when the node has at least one selected tag', () => {
    expect(matchesTags(node, ['typescript'])).toBe(true);
    expect(matchesTags(node, ['react', 'backend'])).toBe(true);
  });

  it('returns false when none of the selected tags are on the node', () => {
    expect(matchesTags(node, ['backend'])).toBe(false);
    expect(matchesTags(node, ['python', 'django'])).toBe(false);
  });

  it('returns false for a node with no tags when tags are selected', () => {
    const noTagNode = makeNode({ id: 'n2', tags: [] });
    expect(matchesTags(noTagNode, ['typescript'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// matchesFolder
// ---------------------------------------------------------------------------

describe('matchesFolder', () => {
  const node = makeNode({ id: 'n1', folder: 'projects', path: 'projects/my-project/note.md' });

  it('returns true when selectedFolders is empty', () => {
    expect(matchesFolder(node, [])).toBe(true);
  });

  it('returns true when the node folder exactly matches a selected folder', () => {
    expect(matchesFolder(node, ['projects'])).toBe(true);
  });

  it('returns true when the node path starts with a selected folder', () => {
    expect(matchesFolder(node, ['projects/my-project'])).toBe(true);
  });

  it('returns false when no selected folder matches', () => {
    expect(matchesFolder(node, ['notes', 'archive'])).toBe(false);
  });

  it('handles root-level notes (folder = "/")', () => {
    const rootNode = makeNode({ id: 'root', folder: '/', path: 'root.md' });
    expect(matchesFolder(rootNode, ['/'])).toBe(true);
    expect(matchesFolder(rootNode, ['projects'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// matchesDateRange
// ---------------------------------------------------------------------------

describe('matchesDateRange', () => {
  const nodeWithDate = makeNode({ id: 'n1', createdAt: '2024-06-15' });
  const nodeWithoutDate = makeNode({ id: 'n2' }); // no createdAt

  it('returns true when both bounds are null', () => {
    expect(matchesDateRange(nodeWithDate, { from: null, to: null })).toBe(true);
  });

  it('returns true for nodes without a createdAt field', () => {
    expect(matchesDateRange(nodeWithoutDate, { from: '2024-01-01', to: '2024-12-31' })).toBe(true);
  });

  it('returns true when the node date is within the range (inclusive)', () => {
    expect(matchesDateRange(nodeWithDate, { from: '2024-01-01', to: '2024-12-31' })).toBe(true);
    expect(matchesDateRange(nodeWithDate, { from: '2024-06-15', to: '2024-06-15' })).toBe(true);
  });

  it('returns false when the node date is before the from bound', () => {
    expect(matchesDateRange(nodeWithDate, { from: '2024-07-01', to: null })).toBe(false);
  });

  it('returns false when the node date is after the to bound', () => {
    expect(matchesDateRange(nodeWithDate, { from: null, to: '2024-05-31' })).toBe(false);
  });

  it('handles only a "from" bound correctly', () => {
    expect(matchesDateRange(nodeWithDate, { from: '2024-06-14', to: null })).toBe(true);
    expect(matchesDateRange(nodeWithDate, { from: '2024-06-16', to: null })).toBe(false);
  });

  it('handles only a "to" bound correctly', () => {
    expect(matchesDateRange(nodeWithDate, { from: null, to: '2024-06-16' })).toBe(true);
    expect(matchesDateRange(nodeWithDate, { from: null, to: '2024-06-14' })).toBe(false);
  });

  it('normalises datetime strings to date-only comparison', () => {
    const nodeWithDatetime = makeNode({ id: 'n3', createdAt: '2024-06-15T12:30:00Z' });
    expect(matchesDateRange(nodeWithDatetime, { from: '2024-06-15', to: '2024-06-15' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchesOrphanFilter
// ---------------------------------------------------------------------------

describe('matchesOrphanFilter', () => {
  const connectedNode = makeNode({ id: 'n1', connectionCount: 5 });
  const orphanNode = makeNode({ id: 'n2', connectionCount: 0 });

  it('returns true for all nodes when showOrphans is true', () => {
    expect(matchesOrphanFilter(connectedNode, true)).toBe(true);
    expect(matchesOrphanFilter(orphanNode, true)).toBe(true);
  });

  it('returns true for connected nodes when showOrphans is false', () => {
    expect(matchesOrphanFilter(connectedNode, false)).toBe(true);
  });

  it('returns false for orphan nodes when showOrphans is false', () => {
    expect(matchesOrphanFilter(orphanNode, false)).toBe(false);
  });

  it('treats connectionCount = 1 as connected', () => {
    const barelyConnected = makeNode({ id: 'n3', connectionCount: 1 });
    expect(matchesOrphanFilter(barelyConnected, false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchesLinkType
// ---------------------------------------------------------------------------

describe('matchesLinkType', () => {
  const wikiLink = makeLink('a', 'b', 'WIKI');
  const markdownLink = makeLink('a', 'b', 'MARKDOWN');
  const embedLink = makeLink('a', 'b', 'EMBED');
  const blockRefLink = makeLink('a', 'b', 'BLOCK_REF');

  it('returns true when selectedLinkTypes is empty', () => {
    expect(matchesLinkType(wikiLink, [])).toBe(true);
  });

  it('returns true when the link type is in the selected list', () => {
    expect(matchesLinkType(wikiLink, ['WIKI'])).toBe(true);
    expect(matchesLinkType(markdownLink, ['WIKI', 'MARKDOWN'])).toBe(true);
  });

  it('returns false when the link type is not in the selected list', () => {
    expect(matchesLinkType(wikiLink, ['MARKDOWN'])).toBe(false);
    expect(matchesLinkType(embedLink, ['WIKI', 'BLOCK_REF'])).toBe(false);
    expect(matchesLinkType(blockRefLink, ['EMBED'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// linkEndpointsVisible
// ---------------------------------------------------------------------------

describe('linkEndpointsVisible', () => {
  it('returns true when neither endpoint is hidden (string IDs)', () => {
    const link = makeLink('a', 'b');
    const hidden = new Set<string>();
    expect(linkEndpointsVisible(link, hidden)).toBe(true);
  });

  it('returns false when the source is hidden', () => {
    const link = makeLink('a', 'b');
    const hidden = new Set(['a']);
    expect(linkEndpointsVisible(link, hidden)).toBe(false);
  });

  it('returns false when the target is hidden', () => {
    const link = makeLink('a', 'b');
    const hidden = new Set(['b']);
    expect(linkEndpointsVisible(link, hidden)).toBe(false);
  });

  it('returns false when both endpoints are hidden', () => {
    const link = makeLink('a', 'b');
    const hidden = new Set(['a', 'b']);
    expect(linkEndpointsVisible(link, hidden)).toBe(false);
  });

  it('handles resolved d3 node objects as source/target', () => {
    const srcNode = makeNode({ id: 'a' });
    const tgtNode = makeNode({ id: 'b' });
    const link: D3GraphLink = {
      source: srcNode,
      target: tgtNode,
      linkType: 'WIKI',
      relationshipTypeSlug: null,
      relationshipTypeColor: null,
    };
    const hidden = new Set(['a']);
    expect(linkEndpointsVisible(link, hidden)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterNodes (composite)
// ---------------------------------------------------------------------------

describe('filterNodes', () => {
  const nodes: D3GraphNode[] = [
    makeNode({
      id: 'a',
      title: 'Alpha',
      path: 'projects/alpha.md',
      tags: ['react'],
      folder: 'projects',
      connectionCount: 3,
    }),
    makeNode({
      id: 'b',
      title: 'Beta',
      path: 'notes/beta.md',
      tags: ['typescript'],
      folder: 'notes',
      connectionCount: 0,
    }),
    makeNode({
      id: 'c',
      title: 'Gamma',
      path: 'projects/gamma.md',
      tags: ['react', 'typescript'],
      folder: 'projects',
      connectionCount: 5,
    }),
    makeNode({
      id: 'd',
      title: 'Delta',
      path: 'archive/delta.md',
      tags: [],
      folder: 'archive',
      connectionCount: 2,
    }),
  ];

  const links: D3GraphLink[] = [
    makeLink('a', 'c', 'WIKI'),
    makeLink('b', 'd', 'MARKDOWN'),
    makeLink('c', 'd', 'EMBED'),
  ];

  it('returns all nodes and links when no filters are active', () => {
    const result = filterNodes(nodes, links, DEFAULT_FILTERS);
    expect(result.visibleNodes).toHaveLength(4);
    expect(result.visibleLinks).toHaveLength(3);
    expect(result.hiddenNodeIds.size).toBe(0);
  });

  it('filters by search query — hides non-matching nodes and their links', () => {
    const result = filterNodes(nodes, links, { ...DEFAULT_FILTERS, searchQuery: 'alpha' });
    expect(result.visibleNodes.map((n) => n.id)).toEqual(['a']);
    // Links a->c: c is hidden, so no links
    expect(result.visibleLinks).toHaveLength(0);
  });

  it('reports searchMatchCount correctly', () => {
    const result = filterNodes(nodes, links, { ...DEFAULT_FILTERS, searchQuery: 'a' });
    // 'Alpha' and 'Gamma' and 'Delta' contain 'a'
    expect(result.searchMatchCount).toBeGreaterThan(0);
  });

  it('returns searchMatchCount = 0 when query is empty', () => {
    const result = filterNodes(nodes, links, DEFAULT_FILTERS);
    expect(result.searchMatchCount).toBe(0);
  });

  it('filters by tag — shows only nodes with matching tags', () => {
    const result = filterNodes(nodes, links, { ...DEFAULT_FILTERS, selectedTags: ['react'] });
    const visibleIds = result.visibleNodes.map((n) => n.id);
    expect(visibleIds).toContain('a'); // has 'react'
    expect(visibleIds).toContain('c'); // has 'react'
    expect(visibleIds).not.toContain('b'); // only 'typescript'
    expect(visibleIds).not.toContain('d'); // no tags
  });

  it('filters by folder — shows only nodes in matching folders', () => {
    const result = filterNodes(nodes, links, { ...DEFAULT_FILTERS, selectedFolders: ['projects'] });
    const visibleIds = result.visibleNodes.map((n) => n.id);
    expect(visibleIds).toContain('a');
    expect(visibleIds).toContain('c');
    expect(visibleIds).not.toContain('b'); // notes/
    expect(visibleIds).not.toContain('d'); // archive/
  });

  it('filters out orphan nodes when showOrphans is false', () => {
    const result = filterNodes(nodes, links, { ...DEFAULT_FILTERS, showOrphans: false });
    expect(result.visibleNodes.map((n) => n.id)).not.toContain('b'); // connectionCount 0
  });

  it('hides links when their link type is not selected', () => {
    const result = filterNodes(nodes, links, { ...DEFAULT_FILTERS, selectedLinkTypes: ['WIKI'] });
    expect(result.visibleLinks).toHaveLength(1);
    expect(result.visibleLinks[0].linkType).toBe('WIKI');
  });

  it('hides links whose source or target is hidden by a node filter', () => {
    // Filter to 'notes' folder: only node b is visible. Link b->d requires d (archive) which is hidden.
    const result = filterNodes(nodes, links, { ...DEFAULT_FILTERS, selectedFolders: ['notes'] });
    expect(result.visibleLinks).toHaveLength(0);
  });

  it('combines multiple filter dimensions (AND logic)', () => {
    const result = filterNodes(nodes, links, {
      ...DEFAULT_FILTERS,
      selectedTags: ['typescript'],
      selectedFolders: ['projects'],
    });
    // Only 'c' has 'typescript' AND is in 'projects'
    expect(result.visibleNodes.map((n) => n.id)).toEqual(['c']);
  });

  it('populates visibleNodeIds and hiddenNodeIds correctly', () => {
    const result = filterNodes(nodes, links, { ...DEFAULT_FILTERS, showOrphans: false });
    expect(result.hiddenNodeIds.has('b')).toBe(true); // orphan
    expect(result.visibleNodeIds.has('a')).toBe(true);
    expect(result.visibleNodeIds.has('b')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSearchHighlighted
// ---------------------------------------------------------------------------

describe('isSearchHighlighted', () => {
  const node = makeNode({ id: 'n1', title: 'TypeScript Guide', path: 'docs/ts.md' });

  it('returns false when query is empty', () => {
    expect(isSearchHighlighted(node, '')).toBe(false);
    expect(isSearchHighlighted(node, '  ')).toBe(false);
  });

  it('returns true when query matches the title', () => {
    expect(isSearchHighlighted(node, 'typescript')).toBe(true);
  });

  it('returns true when query matches the path', () => {
    expect(isSearchHighlighted(node, 'docs')).toBe(true);
  });

  it('returns false when query does not match', () => {
    expect(isSearchHighlighted(node, 'angular')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractAllTags
// ---------------------------------------------------------------------------

describe('extractAllTags', () => {
  it('returns an empty array for an empty node list', () => {
    expect(extractAllTags([])).toHaveLength(0);
  });

  it('returns all unique tags sorted alphabetically', () => {
    const nodes = [
      makeNode({ id: 'a', tags: ['react', 'typescript'] }),
      makeNode({ id: 'b', tags: ['typescript', 'backend'] }),
      makeNode({ id: 'c', tags: ['react'] }),
    ];
    expect(extractAllTags(nodes)).toEqual(['backend', 'react', 'typescript']);
  });

  it('deduplicates tags across nodes', () => {
    const nodes = [
      makeNode({ id: 'a', tags: ['shared'] }),
      makeNode({ id: 'b', tags: ['shared'] }),
    ];
    expect(extractAllTags(nodes)).toHaveLength(1);
  });

  it('handles nodes with no tags', () => {
    const nodes = [makeNode({ id: 'a', tags: [] }), makeNode({ id: 'b', tags: ['only'] })];
    expect(extractAllTags(nodes)).toEqual(['only']);
  });
});

// ---------------------------------------------------------------------------
// buildTagCounts
// ---------------------------------------------------------------------------

describe('buildTagCounts', () => {
  it('returns an empty map for an empty node list', () => {
    expect(buildTagCounts([])).toEqual(new Map());
  });

  it('counts how many nodes carry each tag', () => {
    const nodes = [
      makeNode({ id: 'a', tags: ['react', 'typescript'] }),
      makeNode({ id: 'b', tags: ['react'] }),
      makeNode({ id: 'c', tags: ['typescript'] }),
    ];
    const counts = buildTagCounts(nodes);
    expect(counts.get('react')).toBe(2);
    expect(counts.get('typescript')).toBe(2);
  });

  it('counts a tag appearing multiple times on the same node as 1', () => {
    // In practice nodes shouldn't have duplicate tags, but the function handles it
    const node = makeNode({ id: 'a', tags: ['dup', 'dup'] });
    const counts = buildTagCounts([node]);
    expect(counts.get('dup')).toBe(2); // per-occurrence counting is correct; tags array is the source
  });
});

// ---------------------------------------------------------------------------
// extractAllFolders
// ---------------------------------------------------------------------------

describe('extractAllFolders', () => {
  it('returns an empty array for an empty node list', () => {
    expect(extractAllFolders([])).toHaveLength(0);
  });

  it('returns sorted unique folder names', () => {
    const nodes = [
      makeNode({ id: 'a', folder: 'projects' }),
      makeNode({ id: 'b', folder: 'notes' }),
      makeNode({ id: 'c', folder: 'projects' }),
    ];
    expect(extractAllFolders(nodes)).toEqual(['notes', 'projects']);
  });

  it('excludes root "/" entries', () => {
    const nodes = [makeNode({ id: 'a', folder: '/' }), makeNode({ id: 'b', folder: 'notes' })];
    expect(extractAllFolders(nodes)).toEqual(['notes']);
  });

  it('excludes empty string folder entries', () => {
    const nodes = [makeNode({ id: 'a', folder: '' }), makeNode({ id: 'b', folder: 'archive' })];
    expect(extractAllFolders(nodes)).toEqual(['archive']);
  });
});
