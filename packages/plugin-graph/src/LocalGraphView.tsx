'use client';

/**
 * LocalGraphView — compact force-directed graph for the current note's neighborhood.
 *
 * Features:
 * - BFS to N-hop neighborhood filter (depth 1-3, controlled by slider)
 * - Current note centered and highlighted with a distinct color + ring
 * - Outgoing links (current note → others), incoming links (others → current),
 *   and 2nd-degree connections all displayed
 * - Node click navigates to the clicked note
 * - Auto-updates when noteId prop changes (BFS re-runs on new filteredData)
 * - Compact layout: no controls panel, no search bar — only depth slider
 * - Fit-to-screen runs automatically after simulation settles
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import type { LinkType } from '@notesaner/contracts';
import type { D3GraphNode, D3GraphLink, D3GraphData } from './graph-data';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Color used for the current (focal) note node. */
const FOCAL_NODE_COLOR = '#f59e0b'; // amber-400

/** Stroke ring color for the focal node. */
const FOCAL_RING_COLOR = '#f97316'; // orange-500

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalGraphViewProps {
  /** The note ID that is the center of the local graph. */
  noteId: string;
  /** Full workspace graph data (pre-fetched by the panel wrapper). */
  graphData: D3GraphData;
  /** Called when a node is clicked. Receives the note ID. */
  onNodeClick: (noteId: string) => void;
  /** Optional CSS class applied to the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Edge stroke helpers (shared with GraphView)
// ---------------------------------------------------------------------------

function strokeForLinkType(type: LinkType): {
  stroke: string;
  strokeDasharray: string;
  strokeWidth: number;
} {
  switch (type) {
    case 'WIKI':
      return { stroke: '#6366f1', strokeDasharray: 'none', strokeWidth: 1.5 };
    case 'MARKDOWN':
      return { stroke: '#10b981', strokeDasharray: '4 2', strokeWidth: 1 };
    case 'EMBED':
      return { stroke: '#f59e0b', strokeDasharray: '2 2', strokeWidth: 1.5 };
    case 'BLOCK_REF':
      return { stroke: '#ec4899', strokeDasharray: '6 3 2 3', strokeWidth: 1 };
    default:
      return { stroke: '#94a3b8', strokeDasharray: 'none', strokeWidth: 1 };
  }
}

// ---------------------------------------------------------------------------
// BFS neighborhood filter
// ---------------------------------------------------------------------------

/**
 * Returns the subgraph containing all nodes and links reachable within
 * `maxHops` hops from `focalId` (treating edges as undirected for traversal).
 */
function extractNeighborhood(data: D3GraphData, focalId: string, maxHops: number): D3GraphData {
  // Build adjacency map: nodeId -> Set of adjacent nodeIds
  const adjacency = new Map<string, Set<string>>();

  for (const link of data.links) {
    const srcId = typeof link.source === 'string' ? link.source : link.source.id;
    const tgtId = typeof link.target === 'string' ? link.target : link.target.id;

    if (!adjacency.has(srcId)) adjacency.set(srcId, new Set());
    if (!adjacency.has(tgtId)) adjacency.set(tgtId, new Set());
    adjacency.get(srcId)?.add(tgtId);
    adjacency.get(tgtId)?.add(srcId);
  }

  // BFS from focalId up to maxHops
  const visited = new Map<string, number>(); // nodeId -> depth
  const queue: Array<{ id: string; depth: number }> = [{ id: focalId, depth: 0 }];
  visited.set(focalId, 0);

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const { id, depth } = item;
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
// Depth slider sub-component
// ---------------------------------------------------------------------------

interface DepthSliderProps {
  depth: number;
  onDepthChange: (d: number) => void;
}

function DepthSlider({ depth, onDepthChange }: DepthSliderProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-card/90 px-2.5 py-1.5 backdrop-blur shadow-sm">
      <span className="whitespace-nowrap text-[10px] font-medium text-foreground-muted">Depth</span>
      <input
        type="range"
        min={1}
        max={3}
        step={1}
        value={depth}
        onChange={(e) => onDepthChange(Number(e.target.value))}
        aria-label="Graph depth (hops from current note)"
        className="h-1 w-16 cursor-pointer accent-primary"
      />
      <span className="w-3 text-center text-[10px] font-semibold text-foreground">{depth}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node tooltip
// ---------------------------------------------------------------------------

interface TooltipState {
  x: number;
  y: number;
  node: D3GraphNode;
}

function NodeTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border border-border bg-card px-2 py-1.5 shadow-md"
      style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
    >
      <p className="max-w-[200px] truncate text-[11px] font-semibold text-foreground">
        {tooltip.node.title || 'Untitled'}
      </p>
      <p className="max-w-[200px] truncate text-[9px] text-foreground-muted">{tooltip.node.path}</p>
      {tooltip.node.connectionCount > 0 && (
        <p className="text-[9px] text-foreground-muted">
          {tooltip.node.connectionCount} connection{tooltip.node.connectionCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEndpoint(endpoint: string | D3GraphNode): D3GraphNode | null {
  if (typeof endpoint === 'object' && endpoint !== null) return endpoint;
  return null;
}

function linkTouchesNode(link: D3GraphLink, nodeId: string): boolean {
  const src = resolveEndpoint(link.source);
  const tgt = resolveEndpoint(link.target);
  return src?.id === nodeId || tgt?.id === nodeId;
}

// ---------------------------------------------------------------------------
// Main LocalGraphView component
// ---------------------------------------------------------------------------

/**
 * Compact force-directed graph centered on a single note.
 *
 * The d3 simulation is rebuilt whenever `noteId`, `graphData`, or `depth`
 * changes. React state is minimal: tooltip + depth slider. All per-tick
 * visual updates use direct DOM mutations to avoid re-renders.
 */
export function LocalGraphView({ noteId, graphData, onNodeClick, className }: LocalGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const linkSelRef = useRef<d3.Selection<SVGLineElement, D3GraphLink, SVGGElement, unknown> | null>(
    null,
  );
  const nodeSelRef = useRef<d3.Selection<
    SVGCircleElement,
    D3GraphNode,
    SVGGElement,
    unknown
  > | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<D3GraphNode, D3GraphLink> | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [depth, setDepth] = useState<number>(1);

  // ---------------------------------------------------------------------------
  // Neighborhood extraction (pure computation during render)
  // ---------------------------------------------------------------------------

  const neighborhood = useMemo(
    () => extractNeighborhood(graphData, noteId, depth),
    [graphData, noteId, depth],
  );

  // ---------------------------------------------------------------------------
  // Fit to screen helper
  // ---------------------------------------------------------------------------

  const fitToScreen = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !containerRef.current) return;
    const nodes = simulationRef.current?.nodes() ?? [];
    if (nodes.length === 0) return;

    const W = containerRef.current.clientWidth;
    const H = containerRef.current.clientHeight;
    const PADDING = 40;

    const xs = nodes.map((n) => n.x ?? 0);
    const ys = nodes.map((n) => n.y ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const bW = maxX - minX || 1;
    const bH = maxY - minY || 1;
    const scale = Math.min((W - PADDING * 2) / bW, (H - PADDING * 2) / bH, 3);
    const tx = W / 2 - scale * (minX + bW / 2);
    const ty = H / 2 - scale * (minY + bH / 2);

    const sel = d3.select(svgRef.current) as d3.Selection<SVGSVGElement, unknown, null, undefined>;
    sel
      .transition()
      .duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, []);

  // ---------------------------------------------------------------------------
  // d3 simulation (runs when neighborhood or noteId changes)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const W = containerRef.current.clientWidth;
    const H = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const root = svg.append('g').attr('class', 'local-graph-root');

    // Arrowhead markers
    const defs = svg.append('defs');
    const LINK_TYPES_LIST: LinkType[] = ['WIKI', 'MARKDOWN', 'EMBED', 'BLOCK_REF'];
    LINK_TYPES_LIST.forEach((type) => {
      const { stroke } = strokeForLinkType(type);
      defs
        .append('marker')
        .attr('id', `lg-arrow-${type}`)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('refX', 5)
        .attr('refY', 2.5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,0 L0,5 L5,2.5 z')
        .attr('fill', stroke)
        .attr('opacity', 0.7);
    });

    // Clone nodes for simulation
    const simNodes: D3GraphNode[] = neighborhood.nodes.map((n) => ({
      ...n,
      // Pin the focal node at center initially
      ...(n.id === noteId ? { fx: W / 2, fy: H / 2 } : {}),
    }));
    const nodeIndex = new Map<string, D3GraphNode>(simNodes.map((n) => [n.id, n]));

    const simLinks: D3GraphLink[] = neighborhood.links.map((l) => {
      const srcId = typeof l.source === 'string' ? l.source : l.source.id;
      const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
      return {
        source: nodeIndex.get(srcId) ?? srcId,
        target: nodeIndex.get(tgtId) ?? tgtId,
        linkType: l.linkType,
        relationshipTypeSlug: l.relationshipTypeSlug,
        relationshipTypeColor: l.relationshipTypeColor,
      };
    });

    // Edges
    const linkGroup = root.append('g').attr('class', 'links');
    const linkSel = linkGroup
      .selectAll<SVGLineElement, D3GraphLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke-linecap', 'round')
      .attr('marker-end', (d) => `url(#lg-arrow-${d.linkType})`)
      .each(function (d) {
        const {
          stroke: defaultStroke,
          strokeDasharray,
          strokeWidth,
        } = strokeForLinkType(d.linkType);
        const stroke = d.relationshipTypeColor ?? defaultStroke;
        d3.select(this)
          .attr('stroke', stroke)
          .attr('stroke-dasharray', strokeDasharray === 'none' ? null : strokeDasharray)
          .attr('stroke-width', strokeWidth)
          .attr('opacity', 0.55);
      });

    linkSelRef.current = linkSel;

    // Nodes
    const nodeGroup = root.append('g').attr('class', 'nodes');
    const nodeSel = nodeGroup
      .selectAll<SVGCircleElement, D3GraphNode>('circle')
      .data(simNodes, (d) => d.id)
      .join('circle')
      .attr('r', (d) => (d.id === noteId ? d.radius + 2 : d.radius))
      .attr('fill', (d) => (d.id === noteId ? FOCAL_NODE_COLOR : d.color))
      .attr('stroke', (d) =>
        d.id === noteId ? FOCAL_RING_COLOR : 'var(--color-background, #0f172a)',
      )
      .attr('stroke-width', (d) => (d.id === noteId ? 2.5 : 1.5))
      .attr('cursor', 'pointer')
      .attr('opacity', 1);

    nodeSelRef.current = nodeSel;

    // Simulation — tighter layout for compact panel
    const simulation = d3
      .forceSimulation<D3GraphNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<D3GraphNode, D3GraphLink>(simLinks)
          .id((d) => d.id)
          .distance(55)
          .strength(0.5),
      )
      .force('charge', d3.forceManyBody<D3GraphNode>().strength(-120))
      .force('center', d3.forceCenter<D3GraphNode>(W / 2, H / 2))
      .force(
        'collide',
        d3.forceCollide<D3GraphNode>().radius((d) => d.radius + 3),
      )
      .alphaDecay(0.03);

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d) => resolveEndpoint(d.source as D3GraphLink['source'])?.x ?? 0)
        .attr('y1', (d) => resolveEndpoint(d.source as D3GraphLink['source'])?.y ?? 0)
        .attr('x2', (d) => {
          const tgt = resolveEndpoint(d.target as D3GraphLink['target']);
          const src = resolveEndpoint(d.source as D3GraphLink['source']);
          if (!tgt || !src) return 0;
          const dx = (tgt.x ?? 0) - (src.x ?? 0);
          const dy = (tgt.y ?? 0) - (src.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (tgt.x ?? 0) - (dx / dist) * (tgt.radius + 5);
        })
        .attr('y2', (d) => {
          const tgt = resolveEndpoint(d.target as D3GraphLink['target']);
          const src = resolveEndpoint(d.source as D3GraphLink['source']);
          if (!tgt || !src) return 0;
          const dx = (tgt.x ?? 0) - (src.x ?? 0);
          const dy = (tgt.y ?? 0) - (src.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (tgt.y ?? 0) - (dy / dist) * (tgt.radius + 5);
        });

      nodeSel.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
    });

    // Auto-fit when simulation cools down
    simulation.on('end', () => {
      fitToScreen();
    });

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 6])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        root.attr('transform', event.transform.toString());
      });

    zoomRef.current = zoom;
    svg.call(zoom).on('dblclick.zoom', null);

    // Drag
    let dragMoved = false;
    nodeSel.call(
      d3
        .drag<SVGCircleElement, D3GraphNode>()
        .on('start', (event, d) => {
          dragMoved = false;
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          dragMoved = true;
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, _d) => {
          if (!event.active) simulation.alphaTarget(0);
          // Keep pinned — double-click unpins
        }),
    );

    // Double-click to unpin
    nodeSel.on('dblclick', (_event: MouseEvent, d: D3GraphNode) => {
      d.fx = null;
      d.fy = null;
      simulation.alphaTarget(0.1).restart();
    });

    // Hover interactions
    nodeSel
      .on('mouseenter', (event: MouseEvent, d: D3GraphNode) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d });

        const neighborIds = new Set<string>([d.id]);
        linkSel.each((l) => {
          if (linkTouchesNode(l, d.id)) {
            const src = resolveEndpoint(l.source);
            const tgt = resolveEndpoint(l.target);
            if (src) neighborIds.add(src.id);
            if (tgt) neighborIds.add(tgt.id);
          }
        });

        nodeSel.attr('opacity', (n) => (neighborIds.has(n.id) ? 1 : 0.15));
        linkSel.attr('opacity', (l) => (linkTouchesNode(l, d.id) ? 0.85 : 0.05));
      })
      .on('mousemove', (event: MouseEvent) => {
        setTooltip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : null));
      })
      .on('mouseleave', () => {
        setTooltip(null);
        nodeSel.attr('opacity', 1);
        linkSel.attr('opacity', 0.55);
      });

    // Click to navigate
    nodeSel.on('click', (_event: MouseEvent, d: D3GraphNode) => {
      if (!dragMoved) {
        onNodeClick(d.id);
      }
    });

    return () => {
      simulation.stop();
    };
  }, [neighborhood, noteId, fitToScreen, onNodeClick]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const nodeCount = neighborhood.nodes.length;
  const isIsolated = nodeCount <= 1;

  return (
    <div
      ref={containerRef}
      className={['relative h-full w-full overflow-hidden bg-background', className ?? ''].join(
        ' ',
      )}
    >
      {isIsolated ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-sidebar-muted">
            No connections within {depth} hop{depth !== 1 ? 's' : ''}
          </p>
        </div>
      ) : (
        <svg ref={svgRef} className="h-full w-full" aria-label="Local note graph" role="img" />
      )}

      {/* Depth slider — bottom-left overlay */}
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2">
        <DepthSlider depth={depth} onDepthChange={setDepth} />
        {!isIsolated && (
          <span className="rounded bg-card/80 px-1.5 py-0.5 text-[10px] text-foreground-muted backdrop-blur">
            {nodeCount} notes
          </span>
        )}
      </div>

      <NodeTooltip tooltip={tooltip} />
    </div>
  );
}
