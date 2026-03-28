/**
 * graph-filter-utils — Pure functions for applying graph filters to node/link sets.
 *
 * All functions are pure (no side effects, no store access) and therefore
 * trivially testable and composable.
 *
 * Main entry point: `filterNodes(nodes, links, filters)` which returns the set
 * of visible node IDs after all active filters have been applied.
 */

import type { LinkType } from '@notesaner/contracts';
import type { D3GraphNode, D3GraphLink } from './graph-data';
import type { GraphFilterState, DateRange } from './graph-filter-store';

// ---------------------------------------------------------------------------
// Individual filter predicates
// ---------------------------------------------------------------------------

/**
 * Returns true when the node's title or path contains the search query
 * (case-insensitive).  An empty query always returns true.
 */
export function matchesSearchQuery(node: D3GraphNode, query: string): boolean {
  if (query.trim().length === 0) return true;
  const q = query.toLowerCase();
  return node.title.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
}

/**
 * Returns true when the node has at least one of the selected tags.
 * An empty selectedTags array means "show all tags" — returns true.
 */
export function matchesTags(node: D3GraphNode, selectedTags: string[]): boolean {
  if (selectedTags.length === 0) return true;
  return selectedTags.some((tag) => node.tags.includes(tag));
}

/**
 * Returns true when the node belongs to one of the selected folders.
 *
 * Matching is prefix-based: a folder of "projects" matches paths starting
 * with "projects/" or equal to "projects".  The node's `folder` field
 * (first path segment, computed in graph-data.ts) is compared against each
 * selected folder entry.
 *
 * An empty selectedFolders array means "show all folders" — returns true.
 */
export function matchesFolder(node: D3GraphNode, selectedFolders: string[]): boolean {
  if (selectedFolders.length === 0) return true;
  return selectedFolders.some(
    (folder) => node.folder === folder || node.path.startsWith(`${folder}/`),
  );
}

/**
 * Returns true when the node's creation date falls within the given date range.
 *
 * `node.createdAt` is an ISO 8601 string (or undefined for nodes that don't
 * carry this field — treated as a pass-through).
 * Both range bounds are inclusive.  Null bounds are treated as unbounded.
 */
export function matchesDateRange(
  node: D3GraphNode & { createdAt?: string },
  range: DateRange,
): boolean {
  if (range.from === null && range.to === null) return true;
  const raw = node.createdAt;
  if (!raw) return true; // nodes without a date are never hidden by date filter

  const date = raw.slice(0, 10); // normalise to YYYY-MM-DD
  if (range.from !== null && date < range.from) return false;
  if (range.to !== null && date > range.to) return false;
  return true;
}

/**
 * Returns true when the node has at least one connection (i.e., is not an orphan).
 * When showOrphans is true every node passes regardless.
 */
export function matchesOrphanFilter(node: D3GraphNode, showOrphans: boolean): boolean {
  if (showOrphans) return true;
  return node.connectionCount > 0;
}

// ---------------------------------------------------------------------------
// Link filter
// ---------------------------------------------------------------------------

/**
 * Returns true when the link should be visible given the selected link types.
 * An empty selectedLinkTypes array means "show all link types".
 */
export function matchesLinkType(link: D3GraphLink, selectedLinkTypes: LinkType[]): boolean {
  if (selectedLinkTypes.length === 0) return true;
  return selectedLinkTypes.includes(link.linkType);
}

/**
 * Returns true when neither the source nor the target of the link is hidden.
 */
export function linkEndpointsVisible(
  link: D3GraphLink,
  hiddenNodeIds: ReadonlySet<string>,
): boolean {
  const srcId = typeof link.source === 'string' ? link.source : link.source.id;
  const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
  return !hiddenNodeIds.has(srcId) && !hiddenNodeIds.has(tgtId);
}

// ---------------------------------------------------------------------------
// Composite filter
// ---------------------------------------------------------------------------

export interface FilterResult {
  /** IDs of nodes that pass all active filters. */
  visibleNodeIds: ReadonlySet<string>;
  /** IDs of nodes that do NOT pass at least one filter. */
  hiddenNodeIds: ReadonlySet<string>;
  /** Nodes that pass all active filters. */
  visibleNodes: D3GraphNode[];
  /** Links whose both endpoints are visible and that pass the link-type filter. */
  visibleLinks: D3GraphLink[];
  /** Number of nodes matching the search query (used for match count display). */
  searchMatchCount: number;
}

/**
 * Apply all active filters and return visible node IDs, hidden node IDs,
 * filtered node array, and filtered link array.
 *
 * This is the single composite entry point consumed by graph components.
 *
 * @param nodes   Full unfiltered node list (D3GraphNode[])
 * @param links   Full unfiltered link list (D3GraphLink[])
 * @param filters Current filter state from useGraphFilterStore
 */
export function filterNodes(
  nodes: D3GraphNode[],
  links: D3GraphLink[],
  filters: GraphFilterState,
): FilterResult {
  const hiddenSet = new Set<string>();
  let searchMatchCount = 0;

  for (const node of nodes) {
    const n = node as D3GraphNode & { createdAt?: string };

    const passes =
      matchesSearchQuery(n, filters.searchQuery) &&
      matchesTags(n, filters.selectedTags) &&
      matchesFolder(n, filters.selectedFolders) &&
      matchesDateRange(n, filters.dateRange) &&
      matchesOrphanFilter(n, filters.showOrphans);

    if (!passes) {
      hiddenSet.add(node.id);
    } else if (filters.searchQuery.trim().length > 0) {
      // Count nodes that pass the query filter for the match count badge
      searchMatchCount++;
    }
  }

  // When search is active but nothing else, count the matches from the unfiltered set
  // (the count above already captures passing-only nodes — that's intentional)
  if (filters.searchQuery.trim().length === 0) {
    searchMatchCount = 0;
  }

  const visibleSet = new Set<string>();
  const visibleNodes: D3GraphNode[] = [];
  for (const node of nodes) {
    if (!hiddenSet.has(node.id)) {
      visibleSet.add(node.id);
      visibleNodes.push(node);
    }
  }

  const visibleLinks = links.filter(
    (l) => linkEndpointsVisible(l, hiddenSet) && matchesLinkType(l, filters.selectedLinkTypes),
  );

  return {
    visibleNodeIds: visibleSet,
    hiddenNodeIds: hiddenSet,
    visibleNodes,
    visibleLinks,
    searchMatchCount,
  };
}

// ---------------------------------------------------------------------------
// Highlight helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when a node should be visually highlighted (search ring shown).
 * Highlight is applied only when there is an active search query.
 */
export function isSearchHighlighted(node: D3GraphNode, query: string): boolean {
  if (query.trim().length === 0) return false;
  return matchesSearchQuery(node, query);
}

// ---------------------------------------------------------------------------
// Tag extraction utility
// ---------------------------------------------------------------------------

/**
 * Derives a sorted, deduplicated list of all tag slugs present in a node set.
 * Useful for populating the tag checkbox list in the filter panel.
 *
 * @param nodes  Array of nodes to extract tags from
 * @returns Sorted array of unique tag strings
 */
export function extractAllTags(nodes: D3GraphNode[]): string[] {
  const tags = new Set<string>();
  for (const node of nodes) {
    for (const tag of node.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}

/**
 * Builds a map from tag slug to the number of nodes that carry it.
 * Useful for displaying counts next to tag checkboxes.
 */
export function buildTagCounts(nodes: D3GraphNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    for (const tag of node.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Folder extraction utility
// ---------------------------------------------------------------------------

/**
 * Derives a sorted, deduplicated list of all top-level folder names present in a
 * node set.  Uses the `folder` field (first path segment) computed in graph-data.ts.
 */
export function extractAllFolders(nodes: D3GraphNode[]): string[] {
  const folders = new Set<string>();
  for (const node of nodes) {
    if (node.folder && node.folder !== '/') {
      folders.add(node.folder);
    }
  }
  return [...folders].sort();
}
