/**
 * Semantic clustering for the knowledge graph.
 *
 * Provides:
 * - computeClusters: groups nodes by shared tags with similarity scoring
 * - computeConvexHull: gift-wrapping algorithm to find the convex hull of a
 *   set of 2D points (no external dependency required)
 * - padHull: inflates a hull polygon outward by a given radius for visual padding
 * - hullPath: serialises a polygon to an SVG path string
 * - centroid: computes the geometric centroid of a polygon
 */

import type { D3GraphNode, D3GraphLink } from './graph-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A 2-D coordinate. */
export interface Point {
  x: number;
  y: number;
}

/**
 * A computed cluster of graph nodes.
 *
 * Each cluster corresponds to a dominant tag. Nodes may belong to multiple
 * tags but are assigned to the cluster whose tag they share most frequently
 * with their neighbours (similarity score).
 */
export interface GraphCluster {
  /** The tag that defines this cluster. */
  tag: string;
  /** Hex fill color, derived from the tag's deterministic color. */
  color: string;
  /** Node IDs belonging to this cluster. */
  nodeIds: Set<string>;
  /** Similarity score: fraction of cluster nodes that share this tag. */
  score: number;
}

/**
 * A cluster with hull geometry ready for rendering.
 * Produced by enrichClustersWithHulls().
 */
export interface GraphClusterWithHull extends GraphCluster {
  /** Convex hull polygon points (padded). */
  hull: Point[];
  /** SVG path string for the hull polygon. */
  hullPath: string;
  /** Geometric centroid for the cluster label. */
  centroid: Point;
}

// ---------------------------------------------------------------------------
// Tag color palette (mirrors graph-data.ts for consistent coloring)
// ---------------------------------------------------------------------------

const TAG_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
];

const tagColorCache = new Map<string, string>();

function colorForTag(tag: string): string {
  const cached = tagColorCache.get(tag);
  if (cached !== undefined) return cached;
  let hash = 5381;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 33) ^ tag.charCodeAt(i);
  }
  const color = TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
  tagColorCache.set(tag, color);
  return color;
}

// ---------------------------------------------------------------------------
// Similarity scoring
// ---------------------------------------------------------------------------

/**
 * Builds a per-node adjacency lookup from links.
 * After d3 resolves links, source/target may be objects or string IDs.
 */
function buildAdjacency(links: D3GraphLink[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();

  function add(a: string, b: string) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)?.add(b);
    adj.get(b)?.add(a);
  }

  for (const link of links) {
    const srcId = typeof link.source === 'string' ? link.source : link.source.id;
    const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
    add(srcId, tgtId);
  }

  return adj;
}

/**
 * Computes a similarity score for assigning a node to a tag-cluster.
 *
 * Score = (# of neighbours that also have this tag + 1) / (total neighbours + 1)
 *
 * The +1 ensures nodes with no neighbours still get a non-zero base score.
 */
function tagSimilarityScore(
  node: D3GraphNode,
  tag: string,
  adjacency: Map<string, Set<string>>,
  nodeById: Map<string, D3GraphNode>,
): number {
  const neighbours = adjacency.get(node.id) ?? new Set<string>();
  let sharedCount = 0;
  for (const nId of neighbours) {
    const n = nodeById.get(nId);
    if (n && n.tags.includes(tag)) sharedCount++;
  }
  return (sharedCount + 1) / (neighbours.size + 1);
}

// ---------------------------------------------------------------------------
// Cluster computation
// ---------------------------------------------------------------------------

/**
 * Minimum number of nodes required to form a visible cluster.
 * Clusters smaller than this threshold are discarded.
 */
const MIN_CLUSTER_SIZE = 2;

/**
 * Maximum number of clusters rendered simultaneously.
 * When there are more tags than this, only the top-N by node count are used.
 */
const MAX_CLUSTERS = 12;

/**
 * Groups nodes into clusters based on shared tags and link proximity.
 *
 * Algorithm:
 * 1. Collect all distinct tags across all nodes.
 * 2. For each tag, compute the similarity score for every node that has it.
 * 3. Assign each node to its highest-scoring tag cluster when it shares that
 *    tag.  A node may appear in multiple clusters if it has multiple tags
 *    (intentional — a note about both "react" and "architecture" should appear
 *    in both cluster hulls).
 * 4. Discard clusters below MIN_CLUSTER_SIZE.
 * 5. Sort by node count descending and return at most MAX_CLUSTERS.
 */
export function computeClusters(nodes: D3GraphNode[], links: D3GraphLink[]): GraphCluster[] {
  if (nodes.length === 0) return [];

  const nodeById = new Map<string, D3GraphNode>(nodes.map((n) => [n.id, n]));
  const adjacency = buildAdjacency(links);

  // Collect all tags present in the visible node set
  const allTags = new Set<string>();
  for (const node of nodes) {
    for (const tag of node.tags) {
      allTags.add(tag);
    }
  }

  const clusterMap = new Map<string, { nodeIds: Set<string>; totalScore: number }>();

  for (const tag of allTags) {
    const tagNodes = nodes.filter((n) => n.tags.includes(tag));
    if (tagNodes.length < MIN_CLUSTER_SIZE) continue;

    let totalScore = 0;
    const nodeIds = new Set<string>();

    for (const node of tagNodes) {
      const score = tagSimilarityScore(node, tag, adjacency, nodeById);
      totalScore += score;
      nodeIds.add(node.id);
    }

    clusterMap.set(tag, { nodeIds, totalScore });
  }

  // Build and sort clusters
  const clusters: GraphCluster[] = Array.from(clusterMap.entries()).map(
    ([tag, { nodeIds, totalScore }]) => ({
      tag,
      color: colorForTag(tag),
      nodeIds,
      score: totalScore / nodeIds.size,
    }),
  );

  // Sort by node count descending, then by score for tie-breaking
  clusters.sort((a, b) => {
    const sizeDiff = b.nodeIds.size - a.nodeIds.size;
    if (sizeDiff !== 0) return sizeDiff;
    return b.score - a.score;
  });

  return clusters.slice(0, MAX_CLUSTERS);
}

// ---------------------------------------------------------------------------
// Convex hull (gift-wrapping / Jarvis march)
// ---------------------------------------------------------------------------

/** Returns the cross product of vectors OA and OB. */
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Computes the convex hull of an array of 2-D points using the
 * gift-wrapping (Jarvis march) algorithm.
 *
 * Returns points in counter-clockwise order.
 * Returns an empty array when fewer than 3 distinct points are provided.
 * When exactly 2 distinct points are provided, returns them as a degenerate
 * hull (a line segment — callers should handle this case).
 */
export function computeConvexHull(points: Point[]): Point[] {
  const n = points.length;
  if (n < 2) return points.slice();

  // Remove duplicates
  const unique: Point[] = [];
  const seen = new Set<string>();
  for (const p of points) {
    const key = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }

  if (unique.length < 2) return unique;
  if (unique.length === 2) return unique;

  // Find the leftmost point as the starting point
  let start = 0;
  for (let i = 1; i < unique.length; i++) {
    if (
      unique[i].x < unique[start].x ||
      (unique[i].x === unique[start].x && unique[i].y < unique[start].y)
    ) {
      start = i;
    }
  }

  const hull: Point[] = [];
  let current = start;

  while (true) {
    hull.push(unique[current]);
    let next = 0;

    for (let i = 1; i < unique.length; i++) {
      if (i === current) continue;
      const c = cross(unique[current], unique[next], unique[i]);
      if (
        c < 0 || // unique[i] is more counter-clockwise
        (c === 0 &&
          // collinear: pick the farther point
          Math.hypot(unique[i].x - unique[current].x, unique[i].y - unique[current].y) >
            Math.hypot(unique[next].x - unique[current].x, unique[next].y - unique[current].y))
      ) {
        next = i;
      }
    }

    current = next;
    if (current === start) break;

    // Safety guard: hull cannot be larger than the input
    if (hull.length > unique.length) break;
  }

  return hull;
}

// ---------------------------------------------------------------------------
// Hull padding
// ---------------------------------------------------------------------------

/**
 * Inflates each hull vertex outward from the centroid by `padding` pixels.
 *
 * This creates a visual gap between the hull boundary and the nodes it
 * encloses, making the cluster region easier to read.
 */
export function padHull(hull: Point[], padding: number): Point[] {
  if (hull.length === 0) return [];

  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;

  return hull.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    return {
      x: p.x + (dx / dist) * padding,
      y: p.y + (dy / dist) * padding,
    };
  });
}

// ---------------------------------------------------------------------------
// SVG path generation
// ---------------------------------------------------------------------------

/**
 * Converts a polygon (array of points) to a smooth SVG path string.
 *
 * Uses cubic Bezier curves (Catmull-Rom style) to round the hull corners,
 * which looks more organic than a jagged polygon.
 */
export function hullPath(polygon: Point[]): string {
  if (polygon.length === 0) return '';
  if (polygon.length === 1) return `M${polygon[0].x},${polygon[0].y}Z`;
  if (polygon.length === 2) {
    return `M${polygon[0].x},${polygon[0].y}L${polygon[1].x},${polygon[1].y}Z`;
  }

  // Generate a smooth closed path using rounded corners with Catmull-Rom
  // interpolation simplified to quadratic bezier curves between midpoints.
  const n = polygon.length;
  const parts: string[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = polygon[(i - 1 + n) % n];
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];

    const mx0 = (p0.x + p1.x) / 2;
    const my0 = (p0.y + p1.y) / 2;
    const mx1 = (p1.x + p2.x) / 2;
    const my1 = (p1.y + p2.y) / 2;

    if (i === 0) {
      parts.push(`M${mx0.toFixed(2)},${my0.toFixed(2)}`);
    }
    parts.push(`Q${p1.x.toFixed(2)},${p1.y.toFixed(2)} ${mx1.toFixed(2)},${my1.toFixed(2)}`);
  }

  parts.push('Z');
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Centroid
// ---------------------------------------------------------------------------

/**
 * Computes the geometric centroid (average of all vertices) of a polygon.
 */
export function centroid(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };
  const cx = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
  const cy = polygon.reduce((s, p) => s + p.y, 0) / polygon.length;
  return { x: cx, y: cy };
}

// ---------------------------------------------------------------------------
// Enrich clusters with hull geometry
// ---------------------------------------------------------------------------

/**
 * Amount of padding (px in graph-space) added around each cluster hull.
 */
const HULL_PADDING = 28;

/**
 * Takes computed clusters and the current simulation node positions,
 * then produces hull geometry (convex hull + padding + SVG path + centroid).
 *
 * Call this function on every simulation tick (or after the simulation
 * settles) to keep hulls in sync with node positions.
 *
 * Clusters whose nodes have no valid positions (x/y are undefined) or that
 * produce a degenerate hull (< 3 distinct points) are filtered out.
 */
export function enrichClustersWithHulls(
  clusters: GraphCluster[],
  nodes: D3GraphNode[],
): GraphClusterWithHull[] {
  const nodeById = new Map<string, D3GraphNode>(nodes.map((n) => [n.id, n]));

  const result: GraphClusterWithHull[] = [];

  for (const cluster of clusters) {
    const points: Point[] = [];

    for (const nodeId of cluster.nodeIds) {
      const node = nodeById.get(nodeId);
      if (node && node.x != null && node.y != null) {
        // Add multiple sample points around each node circle so the hull
        // naturally hugs the node shapes rather than just their centers.
        const r = node.radius;
        const SAMPLES = 8;
        for (let i = 0; i < SAMPLES; i++) {
          const angle = (2 * Math.PI * i) / SAMPLES;
          points.push({
            x: node.x + Math.cos(angle) * r,
            y: node.y + Math.sin(angle) * r,
          });
        }
      }
    }

    if (points.length < 3) continue;

    const rawHull = computeConvexHull(points);
    if (rawHull.length < 3) continue;

    const padded = padHull(rawHull, HULL_PADDING);
    const path = hullPath(padded);
    const c = centroid(padded);

    result.push({
      ...cluster,
      hull: padded,
      hullPath: path,
      centroid: c,
    });
  }

  return result;
}
