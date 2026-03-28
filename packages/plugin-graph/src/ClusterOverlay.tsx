'use client';

/**
 * ClusterOverlay — SVG layer that renders semantic cluster regions.
 *
 * Renders convex hull polygons (with rounded corners and padding) behind the
 * graph nodes. Each hull is filled with a semi-transparent version of the
 * cluster's tag color and labelled at its centroid.
 *
 * This component is a pure presentational layer — it receives pre-computed
 * GraphClusterWithHull data from the parent GraphView and re-renders when
 * that data changes.
 */

import type { GraphClusterWithHull } from './clustering';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClusterOverlayProps {
  /** Clusters with hull geometry already computed. */
  clusters: GraphClusterWithHull[];
  /** When false the overlay renders nothing (clustering is toggled off). */
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ClusterOverlay renders SVG paths for each cluster hull plus a text label
 * at the centroid.
 *
 * This element should be placed as a direct child of the d3 "graph-root" `<g>`
 * element, before the link and node groups, so it renders behind them.
 *
 * The component intentionally uses inline SVG elements (not foreignObject)
 * to stay compatible with d3's SVG transform pipeline.
 */
export function ClusterOverlay({ clusters, visible }: ClusterOverlayProps) {
  if (!visible || clusters.length === 0) return null;

  return (
    <>
      {clusters.map((cluster) => (
        <ClusterRegion key={cluster.tag} cluster={cluster} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// ClusterRegion
// ---------------------------------------------------------------------------

interface ClusterRegionProps {
  cluster: GraphClusterWithHull;
}

function ClusterRegion({ cluster }: ClusterRegionProps) {
  const { tag, color, hullPath, centroid } = cluster;

  return (
    <g className="cluster-region" aria-label={`Cluster: ${tag}`}>
      {/* Hull fill */}
      <path
        d={hullPath}
        fill={color}
        fillOpacity={0.08}
        stroke={color}
        strokeOpacity={0.3}
        strokeWidth={1.5}
        strokeLinejoin="round"
        style={{ pointerEvents: 'none' }}
      />

      {/* Cluster label */}
      <ClusterLabel x={centroid.x} y={centroid.y} tag={tag} color={color} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// ClusterLabel
// ---------------------------------------------------------------------------

interface ClusterLabelProps {
  x: number;
  y: number;
  tag: string;
  color: string;
}

/**
 * Renders a cluster label at the given (x, y) centroid.
 *
 * Uses an SVG <text> element with a <rect> background pill for readability.
 * The label shows the tag name prefixed with #.
 */
function ClusterLabel({ x, y, tag, color }: ClusterLabelProps) {
  const label = `#${tag}`;
  // Approximate text dimensions for the background pill
  const charWidth = 6.5;
  const labelWidth = label.length * charWidth + 10;
  const labelHeight = 16;
  const rx = labelHeight / 2;

  return (
    <g
      transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)})`}
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {/* Background pill */}
      <rect
        x={-(labelWidth / 2)}
        y={-(labelHeight / 2)}
        width={labelWidth}
        height={labelHeight}
        rx={rx}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={1}
      />

      {/* Text */}
      <text
        x={0}
        y={1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontFamily="system-ui, sans-serif"
        fontWeight={600}
        fill={color}
        fillOpacity={0.9}
      >
        {label}
      </text>
    </g>
  );
}
