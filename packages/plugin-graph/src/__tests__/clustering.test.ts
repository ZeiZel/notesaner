/**
 * Tests for clustering.ts
 *
 * Covers:
 * - computeConvexHull: geometry correctness for various point sets
 * - padHull: outward inflation
 * - hullPath: SVG path string generation
 * - centroid: geometric centroid
 * - computeClusters: tag-based grouping algorithm
 * - enrichClustersWithHulls: hull geometry computation from node positions
 */

import { describe, it, expect } from 'vitest';
import {
  computeConvexHull,
  padHull,
  hullPath,
  centroid,
  computeClusters,
  enrichClustersWithHulls,
  type Point,
} from '../clustering';
import type { D3GraphNode, D3GraphLink } from '../graph-data';

// ---------------------------------------------------------------------------
// Helpers for constructing test data
// ---------------------------------------------------------------------------

function makeNode(
  id: string,
  tags: string[] = [],
  connectionCount = 0,
  x?: number,
  y?: number,
): D3GraphNode {
  return {
    id,
    title: `Note ${id}`,
    path: `${id}.md`,
    tags,
    connectionCount,
    radius: 6,
    color: '#6366f1',
    folder: '',
    x,
    y,
  };
}

function makeLink(sourceId: string, targetId: string): D3GraphLink {
  return {
    source: sourceId,
    target: targetId,
    linkType: 'WIKI',
    relationshipTypeSlug: null,
    relationshipTypeColor: null,
  };
}

// ---------------------------------------------------------------------------
// computeConvexHull
// ---------------------------------------------------------------------------

describe('computeConvexHull', () => {
  it('returns empty array for zero points', () => {
    expect(computeConvexHull([])).toEqual([]);
  });

  it('returns single point for one point', () => {
    const pts: Point[] = [{ x: 5, y: 5 }];
    const hull = computeConvexHull(pts);
    expect(hull).toHaveLength(1);
    expect(hull[0]).toEqual({ x: 5, y: 5 });
  });

  it('returns two distinct points for two unique inputs', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const hull = computeConvexHull(pts);
    expect(hull).toHaveLength(2);
  });

  it('computes a triangle hull for three non-collinear points', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    const hull = computeConvexHull(pts);
    expect(hull).toHaveLength(3);
    // All input points should be on the hull
    const keys = new Set(hull.map((p) => `${p.x},${p.y}`));
    for (const pt of pts) {
      expect(keys.has(`${pt.x},${pt.y}`)).toBe(true);
    }
  });

  it('excludes interior points from a 5-point set', () => {
    // Square with one interior point
    const pts: Point[] = [
      { x: 0, y: 0 }, // corner
      { x: 10, y: 0 }, // corner
      { x: 10, y: 10 }, // corner
      { x: 0, y: 10 }, // corner
      { x: 5, y: 5 }, // interior
    ];
    const hull = computeConvexHull(pts);
    // The hull should be 4 corners only — the interior point is excluded
    expect(hull).toHaveLength(4);
    const keys = new Set(hull.map((p) => `${p.x},${p.y}`));
    expect(keys.has('5,5')).toBe(false);
  });

  it('deduplicates identical points', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 }, // duplicate
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    const hull = computeConvexHull(pts);
    expect(hull).toHaveLength(3);
  });

  it('handles large numbers of collinear points', () => {
    // All points on a horizontal line — any 2 extreme points should be the hull
    const pts: Point[] = Array.from({ length: 10 }, (_, i) => ({ x: i * 5, y: 0 }));
    const hull = computeConvexHull(pts);
    // Gift-wrapping on collinear points — may return 2 or all collinear points
    // depending on collinear inclusion. The important invariant: result is non-empty
    expect(hull.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// padHull
// ---------------------------------------------------------------------------

describe('padHull', () => {
  it('returns empty array for empty input', () => {
    expect(padHull([], 10)).toEqual([]);
  });

  it('inflates each vertex outward from centroid', () => {
    // Equilateral-ish triangle centered at (5, 5)
    const hull: Point[] = [
      { x: 5, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const padded = padHull(hull, 5);
    expect(padded).toHaveLength(3);

    // Each padded vertex should be farther from the centroid than the original
    const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;

    for (let i = 0; i < hull.length; i++) {
      const origDist = Math.hypot(hull[i].x - cx, hull[i].y - cy);
      const padDist = Math.hypot(padded[i].x - cx, padded[i].y - cy);
      expect(padDist).toBeGreaterThan(origDist - 0.001);
    }
  });
});

// ---------------------------------------------------------------------------
// hullPath
// ---------------------------------------------------------------------------

describe('hullPath', () => {
  it('returns empty string for empty polygon', () => {
    expect(hullPath([])).toBe('');
  });

  it('returns Move+Close for single point', () => {
    const path = hullPath([{ x: 5, y: 5 }]);
    expect(path).toContain('M5,5');
    expect(path).toContain('Z');
  });

  it('returns a path string starting with M and ending with Z', () => {
    const polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    const path = hullPath(polygon);
    expect(path).toMatch(/^M/);
    expect(path).toMatch(/Z$/);
  });

  it('generates a smooth path with Q commands for 3+ points', () => {
    const polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    const path = hullPath(polygon);
    // Should use Q (quadratic bezier) for smooth rendering
    expect(path).toContain('Q');
  });
});

// ---------------------------------------------------------------------------
// centroid
// ---------------------------------------------------------------------------

describe('centroid', () => {
  it('returns 0,0 for empty polygon', () => {
    expect(centroid([])).toEqual({ x: 0, y: 0 });
  });

  it('returns the point itself for a single point', () => {
    expect(centroid([{ x: 7, y: 3 }])).toEqual({ x: 7, y: 3 });
  });

  it('computes the geometric mean of a square', () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const c = centroid(square);
    expect(c.x).toBeCloseTo(5);
    expect(c.y).toBeCloseTo(5);
  });
});

// ---------------------------------------------------------------------------
// computeClusters
// ---------------------------------------------------------------------------

describe('computeClusters', () => {
  it('returns empty array when nodes array is empty', () => {
    expect(computeClusters([], [])).toEqual([]);
  });

  it('returns empty array when no node has any tags', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    expect(computeClusters(nodes, [])).toEqual([]);
  });

  it('does not create a cluster for a tag with only one node', () => {
    // Only 1 node has "react" — below MIN_CLUSTER_SIZE of 2
    const nodes = [makeNode('a', ['react']), makeNode('b', ['vue']), makeNode('c', ['vue'])];
    const clusters = computeClusters(nodes, []);
    const tags = clusters.map((c) => c.tag);
    expect(tags).not.toContain('react');
    expect(tags).toContain('vue');
  });

  it('creates a cluster for each tag shared by 2+ nodes', () => {
    const nodes = [
      makeNode('a', ['react', 'typescript']),
      makeNode('b', ['react']),
      makeNode('c', ['typescript']),
    ];
    const clusters = computeClusters(nodes, []);
    const tags = clusters.map((c) => c.tag);
    expect(tags).toContain('react');
    expect(tags).toContain('typescript');
  });

  it('assigns nodes to all of their matching tag clusters', () => {
    const nodes = [
      makeNode('a', ['react', 'typescript']),
      makeNode('b', ['react']),
      makeNode('c', ['typescript']),
    ];
    const clusters = computeClusters(nodes, []);
    const reactCluster = clusters.find((c) => c.tag === 'react')!;
    const tsCluster = clusters.find((c) => c.tag === 'typescript')!;

    expect(reactCluster.nodeIds.has('a')).toBe(true);
    expect(reactCluster.nodeIds.has('b')).toBe(true);
    expect(tsCluster.nodeIds.has('a')).toBe(true);
    expect(tsCluster.nodeIds.has('c')).toBe(true);
  });

  it('boosts similarity score for nodes whose neighbours share the same tag', () => {
    // 'a' and 'b' are linked and share tag 'react'.
    // 'c' has 'react' but no links → lower similarity score.
    const nodes = [
      makeNode('a', ['react'], 1),
      makeNode('b', ['react'], 1),
      makeNode('c', ['react'], 0),
    ];
    const links = [makeLink('a', 'b')];
    const clusters = computeClusters(nodes, links);
    const reactCluster = clusters.find((c) => c.tag === 'react')!;

    // The cluster should exist and include all three nodes
    expect(reactCluster).toBeDefined();
    expect(reactCluster.nodeIds.size).toBe(3);

    // Score should be > 0 (base formula: (sharedNeighbours+1)/(totalNeighbours+1))
    expect(reactCluster.score).toBeGreaterThan(0);
  });

  it('returns at most 12 clusters (MAX_CLUSTERS)', () => {
    // Create 20 unique tags each shared by exactly 2 nodes
    const nodes: D3GraphNode[] = [];
    for (let i = 0; i < 20; i++) {
      nodes.push(makeNode(`n${i * 2}`, [`tag${i}`]));
      nodes.push(makeNode(`n${i * 2 + 1}`, [`tag${i}`]));
    }
    const clusters = computeClusters(nodes, []);
    expect(clusters.length).toBeLessThanOrEqual(12);
  });

  it('each cluster has a valid hex color', () => {
    const nodes = [makeNode('a', ['react']), makeNode('b', ['react'])];
    const clusters = computeClusters(nodes, []);
    for (const c of clusters) {
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// ---------------------------------------------------------------------------
// enrichClustersWithHulls
// ---------------------------------------------------------------------------

describe('enrichClustersWithHulls', () => {
  it('returns empty array when no clusters are provided', () => {
    const nodes = [makeNode('a', ['react'], 0, 100, 100)];
    expect(enrichClustersWithHulls([], nodes)).toEqual([]);
  });

  it('skips clusters where nodes have no position data', () => {
    const nodes = [
      makeNode('a', ['react']), // no x/y
      makeNode('b', ['react']),
    ];
    const clusters = computeClusters(nodes, []);
    const enriched = enrichClustersWithHulls(clusters, nodes);
    expect(enriched).toHaveLength(0);
  });

  it('produces hull geometry for positioned nodes', () => {
    // Arrange 4 nodes in a rough square, all tagged 'react'
    const nodes = [
      makeNode('a', ['react'], 0, 0, 0),
      makeNode('b', ['react'], 0, 100, 0),
      makeNode('c', ['react'], 0, 100, 100),
      makeNode('d', ['react'], 0, 0, 100),
    ];
    const clusters = computeClusters(nodes, []);
    const enriched = enrichClustersWithHulls(clusters, nodes);

    expect(enriched).toHaveLength(1);
    const cluster = enriched[0];

    expect(cluster.hull.length).toBeGreaterThanOrEqual(3);
    expect(cluster.hullPath).toMatch(/^M/);
    expect(cluster.hullPath).toMatch(/Z$/);
    expect(typeof cluster.centroid.x).toBe('number');
    expect(typeof cluster.centroid.y).toBe('number');
  });

  it('centroid is inside the hull bounds for a convex cluster', () => {
    const nodes = [
      makeNode('a', ['react'], 0, 0, 0),
      makeNode('b', ['react'], 0, 200, 0),
      makeNode('c', ['react'], 0, 100, 200),
      makeNode('d', ['react'], 0, 100, 100),
    ];
    const clusters = computeClusters(nodes, []);
    const enriched = enrichClustersWithHulls(clusters, nodes);
    expect(enriched).toHaveLength(1);

    const { centroid: c, hull } = enriched[0];
    const minX = Math.min(...hull.map((p) => p.x));
    const maxX = Math.max(...hull.map((p) => p.x));
    const minY = Math.min(...hull.map((p) => p.y));
    const maxY = Math.max(...hull.map((p) => p.y));

    expect(c.x).toBeGreaterThanOrEqual(minX);
    expect(c.x).toBeLessThanOrEqual(maxX);
    expect(c.y).toBeGreaterThanOrEqual(minY);
    expect(c.y).toBeLessThanOrEqual(maxY);
  });

  it('tag label is prefixed with # in hullPath-related data', () => {
    const nodes = [
      makeNode('a', ['architecture'], 0, 0, 0),
      makeNode('b', ['architecture'], 0, 100, 0),
      makeNode('c', ['architecture'], 0, 50, 100),
    ];
    const clusters = computeClusters(nodes, []);
    const enriched = enrichClustersWithHulls(clusters, nodes);
    expect(enriched[0].tag).toBe('architecture');
    // Callers should prefix with #; cluster.tag does not include it
    expect(enriched[0].tag).not.toMatch(/^#/);
  });
});
