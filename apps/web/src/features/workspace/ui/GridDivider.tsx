/**
 * GridDivider.tsx
 *
 * Draggable divider between CSS Grid tracks (columns or rows).
 *
 * Design notes:
 *   - Uses pointer events (pointerdown/pointermove/pointerup) rather than
 *     dnd-kit to keep the resize interaction lightweight and precise.
 *   - Enforces minimum track sizes (MIN_PANE_WIDTH / MIN_PANE_HEIGHT).
 *   - Converts pixel-based drag deltas into proportional fr adjustments
 *     to preserve the CSS Grid's fluid behavior.
 *   - No useEffect: all event binding is done via pointer capture in the
 *     pointerdown handler, cleaned up in pointerup.
 */

'use client';

import { useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import {
  useGridLayoutStore,
  MIN_PANE_WIDTH,
  MIN_PANE_HEIGHT,
  type DividerInfo,
} from '../model/grid-layout-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a track size string into a numeric fr value.
 * Handles "Xfr", "Xpx", and plain numbers. Anything non-parseable returns 1.
 */
function parseFr(track: string): number {
  const trimmed = track.trim();
  if (trimmed.endsWith('fr')) {
    return parseFloat(trimmed) || 1;
  }
  // Treat raw numbers as fr
  const num = parseFloat(trimmed);
  return isNaN(num) ? 1 : num;
}

/**
 * Convert a track size array to an array of fr values.
 */
function tracksToFr(tracks: string[]): number[] {
  return tracks.map(parseFr);
}

/**
 * Format fr values back to CSS Grid track strings.
 */
function frToTracks(frs: number[]): string[] {
  return frs.map((f) => `${Math.max(0.1, f).toFixed(3)}fr`);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GridDividerProps {
  /** Which axis this divider splits */
  axis: 'column' | 'row';
  /** The 0-based index of the gap between tracks */
  index: number;
  /** Reference to the grid container element for measuring */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function GridDivider({ axis, index, containerRef }: GridDividerProps) {
  const startDividerDrag = useGridLayoutStore((s) => s.startDividerDrag);
  const resizeTracks = useGridLayoutStore((s) => s.resizeTracks);
  const stopDividerDrag = useGridLayoutStore((s) => s.stopDividerDrag);
  const tracks = useGridLayoutStore((s) =>
    axis === 'column' ? s.gridConfig.columns : s.gridConfig.rows,
  );

  const startPos = useRef(0);
  const startFrs = useRef<number[]>([]);

  const isHorizontal = axis === 'column';

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      startPos.current = isHorizontal ? e.clientX : e.clientY;
      startFrs.current = tracksToFr(tracks);

      const divider: DividerInfo = { axis, index };
      startDividerDrag(divider);

      function handlePointerMove(ev: PointerEvent) {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const totalSize = isHorizontal ? rect.width : rect.height;
        const minSize = isHorizontal ? MIN_PANE_WIDTH : MIN_PANE_HEIGHT;

        const delta = (isHorizontal ? ev.clientX : ev.clientY) - startPos.current;
        const totalFr = startFrs.current.reduce((a, b) => a + b, 0);
        const frPerPx = totalFr / totalSize;
        const frDelta = delta * frPerPx;

        const newFrs = [...startFrs.current];
        const leftFr = newFrs[index] + frDelta;
        const rightFr = newFrs[index + 1] - frDelta;

        // Enforce minimum sizes in fr units
        const minFr = (minSize / totalSize) * totalFr;

        if (leftFr >= minFr && rightFr >= minFr) {
          newFrs[index] = leftFr;
          newFrs[index + 1] = rightFr;
          resizeTracks(axis, frToTracks(newFrs));
        }
      }

      function handlePointerUp() {
        target.releasePointerCapture(e.pointerId);
        target.removeEventListener('pointermove', handlePointerMove);
        target.removeEventListener('pointerup', handlePointerUp);
        stopDividerDrag();
      }

      target.addEventListener('pointermove', handlePointerMove);
      target.addEventListener('pointerup', handlePointerUp);
    },
    [
      axis,
      index,
      isHorizontal,
      tracks,
      containerRef,
      startDividerDrag,
      resizeTracks,
      stopDividerDrag,
    ],
  );

  // Position the divider overlay on top of the gap between tracks.
  // The divider is absolutely positioned within the grid container and
  // overlays the gap area. We use grid placement to position it.
  const style: React.CSSProperties = isHorizontal
    ? {
        gridColumn: `${index + 1} / ${index + 2}`,
        gridRow: '1 / -1',
        cursor: 'col-resize',
        // Place at the right edge of the track
        justifySelf: 'end',
        width: '8px',
        marginRight: '-4px',
      }
    : {
        gridColumn: '1 / -1',
        gridRow: `${index + 1} / ${index + 2}`,
        cursor: 'row-resize',
        // Place at the bottom edge of the track
        alignSelf: 'end',
        height: '8px',
        marginBottom: '-4px',
      };

  return (
    <div
      role="separator"
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      aria-label={`Resize ${axis} divider`}
      onPointerDown={handlePointerDown}
      style={style}
      className={[
        'group relative z-20 touch-none select-none transition-colors',
        isHorizontal ? 'hover:bg-primary/30' : 'hover:bg-primary/30',
      ].join(' ')}
    >
      {/* Visual handle indicator */}
      <div
        className={[
          'absolute opacity-0 transition-opacity group-hover:opacity-100',
          isHorizontal
            ? 'left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/50'
            : 'left-1/2 top-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/50',
        ].join(' ')}
      />
    </div>
  );
}
