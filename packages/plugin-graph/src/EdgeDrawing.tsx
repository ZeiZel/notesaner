'use client';

/**
 * EdgeDrawing — SVG overlay for drawing new edges by dragging between nodes.
 *
 * Interaction model:
 * 1. Hold Alt (or use edge-drawing mode toggle) and mousedown on a source node.
 * 2. Drag toward a target node — a dashed animated line follows the cursor.
 * 3. When hovering over a candidate target node, the line snaps to its centre
 *    and the target node gets a visual ring.
 * 4. Releasing the mouse over a valid target node fires onEdgeDropped().
 * 5. Releasing over empty space cancels the operation.
 *
 * The component renders:
 * - An invisible hit-detection layer over every node (circles driven by node
 *   simulation positions which are forwarded from GraphView via nodePositions).
 * - A single animated SVG <line> while a drag is in progress.
 * - A highlight ring <circle> on the candidate target.
 *
 * Design decisions:
 * - All drag state lives in React refs to avoid per-mousemove re-renders.
 * - A single setState call triggers re-render only when the drag phase changes
 *   (start / snap-to-target / release).
 * - The component does NOT start a new d3 simulation; it reads positions that
 *   GraphView forwards via nodePositions.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Position of a single graph node in SVG-space (after zoom/pan transform),
 * forwarded from GraphView for hit-detection by the EdgeDrawing overlay.
 *
 * Named GraphNodePosition to avoid collision with the layout-store's NodePosition
 * which only carries {x, y}.
 */
export interface GraphNodePosition {
  id: string;
  /** X coordinate in the transformed SVG coordinate space. */
  x: number;
  /** Y coordinate in the transformed SVG coordinate space. */
  y: number;
  radius: number;
}

export interface EdgeDropPayload {
  /** ID of the note the user dragged FROM. */
  sourceNodeId: string;
  /** ID of the note the user dragged TO. */
  targetNodeId: string;
  /** Screen coordinates where the edge was dropped (for popover placement). */
  dropX: number;
  dropY: number;
}

export interface EdgeDrawingProps {
  /** SVG width (matches parent SVG element). */
  width: number;
  /** SVG height (matches parent SVG element). */
  height: number;
  /**
   * Current d3 simulation positions for all visible nodes,
   * already transformed into SVG-space (accounting for zoom/pan).
   */
  nodePositions: GraphNodePosition[];
  /**
   * When true, every node becomes a drag-source; the user starts a drag by
   * pressing mousedown on a node circle.  When false, the overlay is passive.
   */
  edgeDrawingMode: boolean;
  /** Called when the user successfully drops an edge on a target node. */
  onEdgeDropped: (payload: EdgeDropPayload) => void;
  /** Current d3 zoom transform string so we can apply it to the overlay SVG. */
  zoomTransform: string;
}

// ---------------------------------------------------------------------------
// Internal drag state (kept in a ref to avoid re-renders during drag)
// ---------------------------------------------------------------------------

interface DragState {
  active: boolean;
  sourceId: string;
  /** Starting point in SVG-space (centre of source node). */
  startX: number;
  startY: number;
  /** Current cursor position in SVG-space. */
  curX: number;
  curY: number;
  /** If the cursor is near a node this is set to that node's id. */
  snapTargetId: string | null;
}

const INITIAL_DRAG: DragState = {
  active: false,
  sourceId: '',
  startX: 0,
  startY: 0,
  curX: 0,
  curY: 0,
  snapTargetId: null,
};

/** Snap radius: if the cursor is within this many px of a node centre, snap. */
const SNAP_RADIUS_PX = 24;

// ---------------------------------------------------------------------------
// Helper: convert a client-space point to SVG-space accounting for zoom
// ---------------------------------------------------------------------------

function clientToSvgSpace(
  clientX: number,
  clientY: number,
  svgEl: SVGSVGElement,
): { x: number; y: number } {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EdgeDrawing({
  width,
  height,
  nodePositions,
  edgeDrawingMode,
  onEdgeDropped,
  zoomTransform,
}: EdgeDrawingProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState>({ ...INITIAL_DRAG });

  /**
   * Render state: only the fields needed to paint the SVG overlay.
   * We batch all drag mutations in the ref and only force a re-render
   * when transitional state changes.
   */
  const [renderKey, setRenderKey] = useState(0);
  const forceRender = useCallback(() => setRenderKey((k) => k + 1), []);

  // ---------------------------------------------------------------------------
  // Find snap target from node positions
  // ---------------------------------------------------------------------------

  const findSnapTarget = useCallback(
    (svgX: number, svgY: number, excludeId: string): string | null => {
      for (const pos of nodePositions) {
        if (pos.id === excludeId) continue;
        const dx = pos.x - svgX;
        const dy = pos.y - svgY;
        if (Math.sqrt(dx * dx + dy * dy) <= pos.radius + SNAP_RADIUS_PX) {
          return pos.id;
        }
      }
      return null;
    },
    [nodePositions],
  );

  // ---------------------------------------------------------------------------
  // Drag event handlers (attached to the SVG overlay element)
  // ---------------------------------------------------------------------------

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<SVGCircleElement>, nodeId: string) => {
      if (!edgeDrawingMode) return;
      event.preventDefault();
      event.stopPropagation();

      const svgEl = svgRef.current;
      if (!svgEl) return;

      const pos = nodePositions.find((p) => p.id === nodeId);
      if (!pos) return;

      dragRef.current = {
        active: true,
        sourceId: nodeId,
        startX: pos.x,
        startY: pos.y,
        curX: pos.x,
        curY: pos.y,
        snapTargetId: null,
      };
      forceRender();
    },
    [edgeDrawingMode, nodePositions, forceRender],
  );

  // Global mousemove / mouseup listeners — attached when a drag starts
  useEffect(() => {
    if (!dragRef.current.active) return;

    function handleMouseMove(event: MouseEvent) {
      const svgEl = svgRef.current;
      if (!svgEl || !dragRef.current.active) return;

      const { x: svgX, y: svgY } = clientToSvgSpace(event.clientX, event.clientY, svgEl);

      const snap = findSnapTarget(svgX, svgY, dragRef.current.sourceId);

      const snapPos = snap ? nodePositions.find((p) => p.id === snap) : null;

      dragRef.current = {
        ...dragRef.current,
        curX: snapPos ? snapPos.x : svgX,
        curY: snapPos ? snapPos.y : svgY,
        snapTargetId: snap,
      };
      forceRender();
    }

    function handleMouseUp(event: MouseEvent) {
      if (!dragRef.current.active) return;

      const { snapTargetId, sourceId } = dragRef.current;
      dragRef.current = { ...INITIAL_DRAG };
      forceRender();

      if (snapTargetId && snapTargetId !== sourceId) {
        onEdgeDropped({
          sourceNodeId: sourceId,
          targetNodeId: snapTargetId,
          dropX: event.clientX,
          dropY: event.clientY,
        });
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [renderKey, findSnapTarget, nodePositions, onEdgeDropped]);

  // ---------------------------------------------------------------------------
  // Touch support
  // ---------------------------------------------------------------------------

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<SVGCircleElement>, nodeId: string) => {
      if (!edgeDrawingMode) return;
      event.preventDefault();

      const svgEl = svgRef.current;
      if (!svgEl) return;

      const touch = event.touches[0];
      if (!touch) return;

      const pos = nodePositions.find((p) => p.id === nodeId);
      if (!pos) return;

      dragRef.current = {
        active: true,
        sourceId: nodeId,
        startX: pos.x,
        startY: pos.y,
        curX: pos.x,
        curY: pos.y,
        snapTargetId: null,
      };
      forceRender();
    },
    [edgeDrawingMode, nodePositions, forceRender],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<SVGSVGElement>) => {
      if (!dragRef.current.active) return;
      event.preventDefault();

      const svgEl = svgRef.current;
      if (!svgEl) return;

      const touch = event.touches[0];
      if (!touch) return;

      const { x: svgX, y: svgY } = clientToSvgSpace(touch.clientX, touch.clientY, svgEl);

      const snap = findSnapTarget(svgX, svgY, dragRef.current.sourceId);
      const snapPos = snap ? nodePositions.find((p) => p.id === snap) : null;

      dragRef.current = {
        ...dragRef.current,
        curX: snapPos ? snapPos.x : svgX,
        curY: snapPos ? snapPos.y : svgY,
        snapTargetId: snap,
      };
      forceRender();
    },
    [findSnapTarget, nodePositions, forceRender],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<SVGSVGElement>) => {
      if (!dragRef.current.active) return;

      const { snapTargetId, sourceId } = dragRef.current;
      dragRef.current = { ...INITIAL_DRAG };
      forceRender();

      if (snapTargetId && snapTargetId !== sourceId) {
        const changedTouch = event.changedTouches[0];
        onEdgeDropped({
          sourceNodeId: sourceId,
          targetNodeId: snapTargetId,
          dropX: changedTouch?.clientX ?? 0,
          dropY: changedTouch?.clientY ?? 0,
        });
      }
    },
    [onEdgeDropped, forceRender],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const drag = dragRef.current;

  if (!edgeDrawingMode && !drag.active) {
    return null;
  }

  const snapPos = drag.snapTargetId ? nodePositions.find((p) => p.id === drag.snapTargetId) : null;

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      aria-hidden="true"
      style={{ pointerEvents: edgeDrawingMode ? 'auto' : 'none' }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Apply the same zoom/pan transform as the graph-root group */}
      <g transform={zoomTransform}>
        {/* Invisible hit circles on every node — pointer-events: fill */}
        {edgeDrawingMode &&
          nodePositions.map((pos) => (
            <circle
              key={pos.id}
              cx={pos.x}
              cy={pos.y}
              r={pos.radius + 8}
              fill="transparent"
              style={{ cursor: 'crosshair', pointerEvents: 'fill' }}
              onMouseDown={(e) => handleMouseDown(e, pos.id)}
              onTouchStart={(e) => handleTouchStart(e, pos.id)}
            />
          ))}

        {/* Animated dashed edge being drawn */}
        {drag.active && (
          <line
            x1={drag.startX}
            y1={drag.startY}
            x2={drag.curX}
            y2={drag.curY}
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinecap="round"
            opacity={0.85}
            style={{ pointerEvents: 'none' }}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-20"
              dur="0.4s"
              repeatCount="indefinite"
            />
          </line>
        )}

        {/* Highlight ring on snap target */}
        {drag.active && snapPos && (
          <circle
            cx={snapPos.x}
            cy={snapPos.y}
            r={snapPos.radius + 6}
            fill="none"
            stroke="#6366f1"
            strokeWidth={2.5}
            opacity={0.9}
            style={{ pointerEvents: 'none' }}
          >
            <animate
              attributeName="r"
              values={`${snapPos.radius + 4};${snapPos.radius + 9};${snapPos.radius + 4}`}
              dur="0.7s"
              repeatCount="indefinite"
            />
          </circle>
        )}

        {/* Source node origin ring */}
        {drag.active &&
          (() => {
            const srcPos = nodePositions.find((p) => p.id === drag.sourceId);
            if (!srcPos) return null;
            return (
              <circle
                cx={srcPos.x}
                cy={srcPos.y}
                r={srcPos.radius + 4}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2}
                opacity={0.6}
                style={{ pointerEvents: 'none' }}
              />
            );
          })()}
      </g>
    </svg>
  );
}
