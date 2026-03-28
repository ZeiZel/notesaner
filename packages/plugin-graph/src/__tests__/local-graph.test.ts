/**
 * Tests for LocalGraphView — BFS neighborhood extraction and related logic.
 *
 * The extractNeighborhood function is the core algorithm of LocalGraphView.
 * We replicate it here (kept in sync with the implementation) to test it
 * directly without requiring DOM/React rendering.
 */

import { describe, it, expect } from 'vitest';
import type { D3GraphData, D3GraphNode, D3GraphLink } from '../graph-data';

// ---------------------------------------------------------------------------
// Replicate extractNeighborhood from LocalGraphView.tsx
// (kept in sync with the implementation)
// ---------------------------------------------------------------------------

function extractNeighborhood(data: D3GraphData, focalId: string, maxHops: number): D3GraphData {
  // Build adjacency map: nodeId -> Set of adjacent nodeIds
  const adjacency = new Map<string, Set<string>>();

  for (const link of data.links) {
    const srcId = typeof link.source === 'string' ? link.source : link.source.id;
    const tgtId = typeof link.target === 'string' ? link.target : link.target.id;

    if (!adjacency.has(srcId)) adjacency.set(srcId, new Set());
    if (!adjacency.has(tgtId)) adjacency.set(tgtId, new Set());
    adjacency.get(srcId)!.add(tgtId);
    adjacency.get(tgtId)!.add(srcId);
  }

  // BFS from focalId up to maxHops
  const visited = new Map<string, number>(); // nodeId -> depth
  const queue: Array<{ id: string; depth: number }> = [{ id: focalId, depth: 0 }];
  visited.set(focalId, 0);

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxHops) continue;

    const neighbors = adjacency.get(id) ?? new Set<string>();
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.set(neighborId, depth + 1);
        queue.push({ id: neighborId, depth: depth + 1 });
      }
    }
  }

  // Filter nodes and links to the neighborhood
  const nodeSet = new Set(visited.keys());
  const nodes = data.nodes.filter((n) => nodeSet.has(n.id));
  const links = data.links.filter((l) => {
    const srcId = typeof l.source === 'string' ? l.source : l.source.id;
    const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
    return nodeSet.has(srcId) && nodeSet.has(tgtId);
  });

  return { nodes, links };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeNode(id: string): D3GraphNode {
  return {
    id,
    title: `Note ${id}`,
    path: `${id}.md`,
    tags: [],
    connectionCount: 0,
    radius: 5,
    color: '#94a3b8',
    folder: '/',
  };
}

function makeLink(source: string, target: string): D3GraphLink {
  return {
    source,
    target,
    linkType: 'WIKI',
    relationshipTypeSlug: null,
    relationshipTypeColor: null,
  };
}

/**
 * Builds a D3GraphData with string IDs for source/target on links.
 */
function makeGraph(nodeIds: string[], edges: Array<[string, string]>): D3GraphData {
  return {
    nodes: nodeIds.map(makeNode),
    links: edges.map(([src, tgt]) => makeLink(src, tgt)),
  };
}

// ---------------------------------------------------------------------------
// extractNeighborhood tests
// ---------------------------------------------------------------------------

describe('extractNeighborhood — BFS subgraph extraction', () => {
  // Graph: A --(WIKI)--> B --(WIKI)--> C --(WIKI)--> D --(WIKI)--> E
  const linearGraph = makeGraph(
    ['A', 'B', 'C', 'D', 'E'],
    [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'E'],
    ],
  );

  it('depth 1 from A: includes A + B only', () => {
    const result = extractNeighborhood(linearGraph, 'A', 1);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['A', 'B']);
  });

  it('depth 2 from A: includes A, B, C', () => {
    const result = extractNeighborhood(linearGraph, 'A', 2);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['A', 'B', 'C']);
  });

  it('depth 3 from A: includes A, B, C, D', () => {
    const result = extractNeighborhood(linearGraph, 'A', 3);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['A', 'B', 'C', 'D']);
  });

  it('depth 1 from C (middle): includes B, C, D (bidirectional traversal)', () => {
    const result = extractNeighborhood(linearGraph, 'C', 1);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['B', 'C', 'D']);
  });

  it('depth 2 from C: includes A, B, C, D, E', () => {
    const result = extractNeighborhood(linearGraph, 'C', 2);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('focal node is always included even if isolated', () => {
    const isolatedGraph = makeGraph(['X', 'Y'], []);
    const result = extractNeighborhood(isolatedGraph, 'X', 1);
    expect(result.nodes.map((n) => n.id)).toContain('X');
    // Y has no link to X so it should not appear
    expect(result.nodes.map((n) => n.id)).not.toContain('Y');
  });

  it('returns only the focal node when it has no connections (depth 1)', () => {
    const isolatedGraph = makeGraph(['ISOLATED', 'OTHER'], []);
    const result = extractNeighborhood(isolatedGraph, 'ISOLATED', 1);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('ISOLATED');
    expect(result.links).toHaveLength(0);
  });

  it('links are included only when both endpoints are in the neighborhood', () => {
    // A -> B -> C, depth 1 from A: only A-B link should be included
    const result = extractNeighborhood(linearGraph, 'A', 1);
    expect(result.links).toHaveLength(1);
    const link = result.links[0];
    expect(link.source).toBe('A');
    expect(link.target).toBe('B');
  });

  it('handles a star topology (hub and spokes)', () => {
    // HUB connects to S1, S2, S3, S4
    const starGraph = makeGraph(
      ['HUB', 'S1', 'S2', 'S3', 'S4'],
      [
        ['HUB', 'S1'],
        ['HUB', 'S2'],
        ['HUB', 'S3'],
        ['HUB', 'S4'],
      ],
    );

    const result = extractNeighborhood(starGraph, 'HUB', 1);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['HUB', 'S1', 'S2', 'S3', 'S4']);
    expect(result.links).toHaveLength(4);
  });

  it('handles a star topology from spoke at depth 1: only spoke + hub', () => {
    const starGraph = makeGraph(
      ['HUB', 'S1', 'S2', 'S3'],
      [
        ['HUB', 'S1'],
        ['HUB', 'S2'],
        ['HUB', 'S3'],
      ],
    );

    const result = extractNeighborhood(starGraph, 'S1', 1);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['HUB', 'S1']);
  });

  it('handles a star topology from spoke at depth 2: all spokes via hub', () => {
    const starGraph = makeGraph(
      ['HUB', 'S1', 'S2', 'S3'],
      [
        ['HUB', 'S1'],
        ['HUB', 'S2'],
        ['HUB', 'S3'],
      ],
    );

    const result = extractNeighborhood(starGraph, 'S1', 2);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['HUB', 'S1', 'S2', 'S3']);
  });

  it('handles object-reference source/target in links (post-simulation format)', () => {
    // After d3 simulation, source/target become object references, not strings
    const nodeA = makeNode('A');
    const nodeB = makeNode('B');
    const nodeC = makeNode('C');

    const objectRefGraph: D3GraphData = {
      nodes: [nodeA, nodeB, nodeC],
      links: [
        {
          source: nodeA as unknown as string, // object ref
          target: nodeB as unknown as string,
          linkType: 'WIKI',
          relationshipTypeSlug: null,
          relationshipTypeColor: null,
        },
        {
          source: nodeB as unknown as string,
          target: nodeC as unknown as string,
          linkType: 'WIKI',
          relationshipTypeSlug: null,
          relationshipTypeColor: null,
        },
      ],
    };

    const result = extractNeighborhood(objectRefGraph, 'A', 1);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['A', 'B']);
  });

  it('depth 0 from any node: only the focal node (no traversal)', () => {
    const result = extractNeighborhood(linearGraph, 'C', 0);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('C');
    expect(result.links).toHaveLength(0);
  });

  it('returns all reachable nodes when maxHops is larger than the graph diameter', () => {
    // Linear graph A-B-C-D-E has diameter 4
    // depth 10 from A should reach all 5 nodes
    const result = extractNeighborhood(linearGraph, 'A', 10);
    expect(result.nodes).toHaveLength(5);
  });

  it('handles cycles without infinite loops', () => {
    // Cycle: A -> B -> C -> A
    const cyclicGraph = makeGraph(
      ['A', 'B', 'C'],
      [
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ],
    );

    const result = extractNeighborhood(cyclicGraph, 'A', 2);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['A', 'B', 'C']);
  });

  it('handles disconnected components — does not include unreachable nodes', () => {
    // Component 1: A -- B -- C
    // Component 2: X -- Y (isolated from component 1)
    const disconnectedGraph = makeGraph(
      ['A', 'B', 'C', 'X', 'Y'],
      [
        ['A', 'B'],
        ['B', 'C'],
        ['X', 'Y'],
      ],
    );

    const result = extractNeighborhood(disconnectedGraph, 'A', 3);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['A', 'B', 'C']);
    expect(ids).not.toContain('X');
    expect(ids).not.toContain('Y');
  });

  it('returns correct link count for a dense subgraph', () => {
    // Triangle: A -> B, B -> C, A -> C (3 edges)
    const triangleGraph = makeGraph(
      ['A', 'B', 'C', 'D'],
      [
        ['A', 'B'],
        ['B', 'C'],
        ['A', 'C'],
        ['C', 'D'],
      ],
    );

    // depth 1 from A: A, B, C (all three triangle nodes) — 3 triangle edges
    const result = extractNeighborhood(triangleGraph, 'A', 1);
    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['A', 'B', 'C']);
    expect(result.links).toHaveLength(3);
  });

  it('handles a focalId not present in the graph gracefully', () => {
    // MISSING is not in the graph — only MISSING itself should appear
    // (BFS visits it but finds no adjacency entry)
    const result = extractNeighborhood(linearGraph, 'MISSING', 2);
    // MISSING is not in the nodes list, so the filter returns an empty array
    expect(result.nodes).toHaveLength(0);
  });
});
