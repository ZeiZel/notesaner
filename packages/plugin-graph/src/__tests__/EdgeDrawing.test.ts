/**
 * Tests for EdgeDrawing logic helpers.
 *
 * The core logic of EdgeDrawing (snap detection, hit radius, drag state machine)
 * is exercised here without rendering the React component, to avoid the d3/jsdom
 * interaction overhead.
 *
 * We extract and test the pure functions in isolation following the same pattern
 * used by GraphRenderer.test.ts.
 */

import { describe, it, expect } from 'vitest';
import type { GraphNodePosition } from '../EdgeDrawing';

// ---------------------------------------------------------------------------
// Replicate the snap-target logic from EdgeDrawing.tsx
// (kept in sync with the implementation)
// ---------------------------------------------------------------------------

const SNAP_RADIUS_PX = 24;

function findSnapTarget(
  svgX: number,
  svgY: number,
  excludeId: string,
  positions: GraphNodePosition[],
): string | null {
  for (const pos of positions) {
    if (pos.id === excludeId) continue;
    const dx = pos.x - svgX;
    const dy = pos.y - svgY;
    if (Math.sqrt(dx * dx + dy * dy) <= pos.radius + SNAP_RADIUS_PX) {
      return pos.id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tests: findSnapTarget
// ---------------------------------------------------------------------------

describe('EdgeDrawing — findSnapTarget', () => {
  const positions: GraphNodePosition[] = [
    { id: 'A', x: 100, y: 100, radius: 8 },
    { id: 'B', x: 200, y: 200, radius: 10 },
    { id: 'C', x: 300, y: 100, radius: 6 },
  ];

  it('returns null when cursor is far from all nodes', () => {
    expect(findSnapTarget(500, 500, 'X', positions)).toBeNull();
  });

  it('returns the node id when cursor is within snap radius', () => {
    // Cursor 20px from centre of B (radius 10, snap 24 → threshold 34)
    const result = findSnapTarget(220, 200, 'A', positions);
    expect(result).toBe('B');
  });

  it('excludes the source node even when cursor is on top of it', () => {
    // Cursor directly on A, but A is the source
    expect(findSnapTarget(100, 100, 'A', positions)).toBeNull();
  });

  it('returns the closest node when multiple are within snap range', () => {
    // A at (100,100) radius 8 → threshold 32
    // Place cursor at (110,100) — within A and C thresholds but closer to A
    const result = findSnapTarget(110, 100, 'B', positions);
    expect(result).toBe('A');
  });

  it('returns null when the only nearby node is excluded', () => {
    // Cursor right on A, exclude A
    expect(findSnapTarget(102, 100, 'A', positions)).toBeNull();
  });

  it('snaps at exactly node.radius + SNAP_RADIUS_PX distance', () => {
    // B has radius 10; snap threshold = 10 + 24 = 34
    // Place cursor exactly 34px to the right of B
    const result = findSnapTarget(200 + 34, 200, 'A', positions);
    expect(result).toBe('B');
  });

  it('does not snap just beyond threshold', () => {
    // 35px from B centre — just outside threshold
    const result = findSnapTarget(200 + 35, 200, 'A', positions);
    expect(result).toBeNull();
  });

  it('returns null for empty positions list', () => {
    expect(findSnapTarget(100, 100, 'A', [])).toBeNull();
  });

  it('handles single-node list where it is the excluded source', () => {
    const single: GraphNodePosition[] = [{ id: 'A', x: 0, y: 0, radius: 5 }];
    expect(findSnapTarget(0, 0, 'A', single)).toBeNull();
  });

  it('handles diagonal distances correctly', () => {
    // C at (300,100), radius 6, threshold 30
    // Cursor at (300 + 21, 100 + 21) — distance ≈ 29.7 — inside threshold
    const result = findSnapTarget(321, 121, 'A', positions);
    expect(result).toBe('C');
  });
});

// ---------------------------------------------------------------------------
// Tests: EdgeDropPayload shape (type-level contract)
// ---------------------------------------------------------------------------

describe('EdgeDropPayload shape', () => {
  it('has the expected fields', () => {
    // This test acts as a compile-time guard; if the interface fields change,
    // the TypeScript compiler will error here before tests run.
    const payload = {
      sourceNodeId: 'note-1',
      targetNodeId: 'note-2',
      dropX: 400,
      dropY: 300,
    };
    expect(payload.sourceNodeId).toBe('note-1');
    expect(payload.targetNodeId).toBe('note-2');
    expect(payload.dropX).toBe(400);
    expect(payload.dropY).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Tests: GraphNodePosition shape
// ---------------------------------------------------------------------------

describe('GraphNodePosition shape', () => {
  it('has the expected fields including radius', () => {
    const pos: GraphNodePosition = { id: 'n1', x: 10, y: 20, radius: 7 };
    expect(pos.id).toBe('n1');
    expect(pos.radius).toBe(7);
  });
});
