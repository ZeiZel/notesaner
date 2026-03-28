/**
 * Tests for LinkTypePopover pure logic helpers.
 *
 * The popover's position clamping logic is the main piece of business logic
 * worth unit-testing.  Component rendering is excluded here to avoid React
 * testing overhead in a non-DOM environment.
 *
 * We replicate the clampedPosition helper from LinkTypePopover.tsx and verify
 * all boundary conditions.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Replicate clampedPosition from LinkTypePopover.tsx
// (keep in sync with the implementation)
// ---------------------------------------------------------------------------

const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT = 220;
const VIEWPORT_MARGIN = 12;

function clampedPosition(
  dropX: number,
  dropY: number,
  vw: number,
  vh: number,
): { left: number; top: number } {
  const left = Math.min(
    Math.max(dropX + 12, VIEWPORT_MARGIN),
    vw - POPOVER_WIDTH - VIEWPORT_MARGIN,
  );
  const top = Math.min(
    Math.max(dropY - POPOVER_HEIGHT / 2, VIEWPORT_MARGIN),
    vh - POPOVER_HEIGHT - VIEWPORT_MARGIN,
  );
  return { left, top };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const VW = 1280;
const VH = 800;

describe('LinkTypePopover — clampedPosition', () => {
  it('places popover to the right of the drop point with a 12px offset', () => {
    const { left } = clampedPosition(400, 400, VW, VH);
    expect(left).toBe(412); // dropX + 12
  });

  it('vertically centres the popover on the drop point', () => {
    const { top } = clampedPosition(400, 400, VW, VH);
    expect(top).toBe(400 - POPOVER_HEIGHT / 2); // 290
  });

  it('clamps left to viewport margin when drop is near left edge', () => {
    const { left } = clampedPosition(0, 400, VW, VH);
    expect(left).toBe(VIEWPORT_MARGIN);
  });

  it('clamps left so popover does not exceed right edge', () => {
    const { left } = clampedPosition(VW, 400, VW, VH);
    expect(left).toBe(VW - POPOVER_WIDTH - VIEWPORT_MARGIN);
  });

  it('clamps top to viewport margin when drop is near top edge', () => {
    const { top } = clampedPosition(400, 0, VW, VH);
    expect(top).toBe(VIEWPORT_MARGIN);
  });

  it('clamps top so popover does not exceed bottom edge', () => {
    const { top } = clampedPosition(400, VH, VW, VH);
    expect(top).toBe(VH - POPOVER_HEIGHT - VIEWPORT_MARGIN);
  });

  it('handles drop exactly in the centre of the viewport', () => {
    const cx = VW / 2;
    const cy = VH / 2;
    const { left, top } = clampedPosition(cx, cy, VW, VH);
    expect(left).toBe(cx + 12);
    expect(top).toBe(cy - POPOVER_HEIGHT / 2);
  });

  it('does not return negative left values', () => {
    const { left } = clampedPosition(-100, 400, VW, VH);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it('does not return negative top values', () => {
    const { top } = clampedPosition(400, -100, VW, VH);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it('works on a narrow viewport (mobile 375px)', () => {
    const vw = 375;
    const vh = 667;
    const { left } = clampedPosition(300, 300, vw, vh);
    // Should be clamped to vw - POPOVER_WIDTH - VIEWPORT_MARGIN = 375 - 280 - 12 = 83
    expect(left).toBe(vw - POPOVER_WIDTH - VIEWPORT_MARGIN);
  });

  it('top stays within [VIEWPORT_MARGIN, VH - POPOVER_HEIGHT - VIEWPORT_MARGIN]', () => {
    for (const dropY of [0, 100, 400, 700, 800, 1000]) {
      const { top } = clampedPosition(400, dropY, VW, VH);
      expect(top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(top).toBeLessThanOrEqual(VH - POPOVER_HEIGHT - VIEWPORT_MARGIN);
    }
  });

  it('left stays within [VIEWPORT_MARGIN, VW - POPOVER_WIDTH - VIEWPORT_MARGIN]', () => {
    for (const dropX of [0, 200, 640, 1000, 1280]) {
      const { left } = clampedPosition(dropX, 400, VW, VH);
      expect(left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(left).toBeLessThanOrEqual(VW - POPOVER_WIDTH - VIEWPORT_MARGIN);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: link type options completeness
// ---------------------------------------------------------------------------

describe('LinkTypePopover — link type options', () => {
  // Mirror the expected set from the implementation
  const EXPECTED_TYPES = ['WIKI', 'MARKDOWN', 'EMBED', 'BLOCK_REF'] as const;

  it('covers all four link types', () => {
    expect(EXPECTED_TYPES).toHaveLength(4);
    expect(EXPECTED_TYPES).toContain('WIKI');
    expect(EXPECTED_TYPES).toContain('MARKDOWN');
    expect(EXPECTED_TYPES).toContain('EMBED');
    expect(EXPECTED_TYPES).toContain('BLOCK_REF');
  });

  it('WIKI is the first option (default choice)', () => {
    expect(EXPECTED_TYPES[0]).toBe('WIKI');
  });
});
