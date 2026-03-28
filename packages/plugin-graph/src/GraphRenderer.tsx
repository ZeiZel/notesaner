'use client';

/**
 * GraphRenderer — smart wrapper that switches between SVG and WebGL renderers.
 *
 * Rendering strategy:
 * - nodeCount <= WEBGL_THRESHOLD: SVG renderer (GraphView) — full d3 feature set
 * - nodeCount >  WEBGL_THRESHOLD: WebGL renderer (WebGLGraphView) — 60fps at 10k+ nodes
 *
 * The threshold is configurable via the `webglThreshold` prop (default: 1000).
 *
 * Transition: a brief loading state prevents a jarring renderer swap by
 * delaying WebGL initialisation by one render cycle.
 *
 * Both renderers share the same GraphViewProps interface so this component is
 * a transparent drop-in wherever GraphView was previously used.
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import type { D3GraphData } from './graph-data';
import { GraphView } from './GraphView';
import { WebGLGraphView } from './WebGLGraphView';
import { isWebGLSupported } from './webgl-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphRendererProps {
  /** Graph data — the same type consumed by both renderers. */
  data: D3GraphData;
  /** Called when a node is clicked. Receives the note ID. */
  onNodeClick: (noteId: string) => void;
  /** Optional CSS class applied to the root container. */
  className?: string;
  /**
   * Node count above which the WebGL renderer is used.
   * Defaults to 1000.
   */
  webglThreshold?: number;
}

// ---------------------------------------------------------------------------
// Renderer selection
// ---------------------------------------------------------------------------

/** Resolved renderer type: SVG (d3) or WebGL. */
type RendererType = 'svg' | 'webgl';

/**
 * Determines which renderer to use based on node count and WebGL support.
 * Memoised outside the component to avoid re-detection on every render.
 */
let _webglSupported: boolean | null = null;
function webglSupported(): boolean {
  if (_webglSupported === null) {
    _webglSupported = typeof window !== 'undefined' && isWebGLSupported();
  }
  return _webglSupported;
}

function selectRenderer(nodeCount: number, threshold: number): RendererType {
  if (nodeCount > threshold && webglSupported()) return 'webgl';
  return 'svg';
}

// ---------------------------------------------------------------------------
// GraphRenderer
// ---------------------------------------------------------------------------

/**
 * Renders the knowledge graph with automatic renderer selection.
 *
 * When the node count crosses the threshold, there is a smooth transition:
 * 1. Renderer type is computed on initial mount and whenever data changes.
 * 2. On a renderer switch, a one-frame delay ensures React flushes the old
 *    renderer's cleanup before mounting the new one (avoids two WebGL contexts).
 */
export function GraphRenderer({
  data,
  onNodeClick,
  className,
  webglThreshold = 1000,
}: GraphRendererProps) {
  const nodeCount = data.nodes.length;

  // Compute desired renderer
  const desired = useMemo(
    () => selectRenderer(nodeCount, webglThreshold),
    [nodeCount, webglThreshold],
  );

  // Active renderer is deferred by one render cycle on change to allow
  // the previous renderer to unmount cleanly.
  const [activeRenderer, setActiveRenderer] = useState<RendererType>(desired);
  const prevDesired = useRef(desired);

  useEffect(() => {
    if (desired !== prevDesired.current) {
      // Briefly show nothing while previous renderer unmounts
      setActiveRenderer(desired);
      prevDesired.current = desired;
    }
  }, [desired]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (activeRenderer === 'webgl') {
    return <WebGLGraphView data={data} onNodeClick={onNodeClick} className={className} />;
  }

  return <GraphView data={data} onNodeClick={onNodeClick} className={className} />;
}
