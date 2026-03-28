/**
 * D3-compatible graph data types for the graph visualization plugin.
 *
 * These types extend the base GraphData from @notesaner/contracts
 * with D3 simulation properties (x, y, fx, fy, radius, color).
 *
 * Note: d3.SimulationNodeDatum properties (x, y, vx, vy, fx, fy, index)
 * are added at runtime by d3-force. We declare them here as optional
 * to avoid requiring d3 as a compile-time dependency for this package.
 */
import type { LinkType } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

export interface D3GraphNode {
  id: string;
  title: string;
  path: string;
  tags: string[];
  connectionCount: number;
  /** Visual radius (computed based on connection count). */
  radius: number;
  /** Fill color (derived from tags or cluster). */
  color: string;
  // d3 simulation properties (set at runtime)
  index?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

export interface D3GraphLink {
  source: string | D3GraphNode;
  target: string | D3GraphNode;
  linkType: LinkType;
  /** Optional Zettelkasten relationship type slug. */
  relationshipTypeSlug?: string | null;
  /** Optional color override for the relationship type. */
  relationshipTypeColor?: string | null;
  // d3 simulation properties (set at runtime)
  index?: number;
}

// ---------------------------------------------------------------------------
// Combined graph data
// ---------------------------------------------------------------------------

export interface D3GraphData {
  nodes: D3GraphNode[];
  links: D3GraphLink[];
}

// ---------------------------------------------------------------------------
// API fetch helper
// ---------------------------------------------------------------------------

/**
 * Fetch workspace graph data from the backend API and transform it
 * into D3-compatible format.
 */
export async function fetchGraphData(token: string, workspaceId: string): Promise<D3GraphData> {
  const response = await fetch(`/api/workspaces/${workspaceId}/graph`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch graph data: ${response.statusText}`);
  }

  const data = await response.json();

  // Transform backend GraphData to D3 format
  const nodes: D3GraphNode[] = (data.nodes ?? []).map((n: Record<string, unknown>) => ({
    id: n.id as string,
    title: (n.title as string) || 'Untitled',
    path: (n.path as string) || '',
    tags: (n.tags as string[]) || [],
    connectionCount: (n.connectionCount as number) || 0,
    // Compute visual radius based on connection count
    radius: Math.max(4, Math.min(12, 4 + Math.sqrt((n.connectionCount as number) || 0) * 2)),
    // Default color; can be overridden by tag-based coloring
    color: '#89b4fa',
  }));

  const links: D3GraphLink[] = (data.edges ?? []).map((e: Record<string, unknown>) => ({
    source: e.source as string,
    target: e.target as string,
    linkType: (e.linkType as LinkType) || 'WIKI',
  }));

  return { nodes, links };
}
