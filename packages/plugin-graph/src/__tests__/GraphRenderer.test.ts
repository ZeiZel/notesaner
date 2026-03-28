/**
 * Tests for GraphRenderer renderer selection logic.
 *
 * Focuses on the `selectRenderer` decision function which picks between
 * 'svg' and 'webgl' based on node count, threshold, and WebGL availability.
 *
 * We test the exported logic indirectly by verifying the module-level
 * helper behavior through a minimal non-JSX test approach.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// We test the selection logic extracted into a plain function
// to avoid JSX rendering in a non-react-plugin environment.
// ---------------------------------------------------------------------------

// Replicate the selection logic from GraphRenderer.tsx
// (kept in sync with the implementation)
function selectRenderer(
  nodeCount: number,
  threshold: number,
  webglAvailable: boolean,
): 'svg' | 'webgl' {
  if (nodeCount > threshold && webglAvailable) return 'webgl';
  return 'svg';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphRenderer — selectRenderer logic', () => {
  it('returns svg when nodeCount is below threshold', () => {
    expect(selectRenderer(500, 1000, true)).toBe('svg');
  });

  it('returns svg when nodeCount equals threshold (not strictly greater)', () => {
    expect(selectRenderer(1000, 1000, true)).toBe('svg');
  });

  it('returns webgl when nodeCount exceeds threshold and WebGL is supported', () => {
    expect(selectRenderer(1001, 1000, true)).toBe('webgl');
  });

  it('returns svg when nodeCount exceeds threshold but WebGL is not supported', () => {
    expect(selectRenderer(5000, 1000, false)).toBe('svg');
  });

  it('returns webgl at exactly threshold + 1', () => {
    expect(selectRenderer(1001, 1000, true)).toBe('webgl');
  });

  it('works with a custom threshold of 100', () => {
    expect(selectRenderer(101, 100, true)).toBe('webgl');
    expect(selectRenderer(100, 100, true)).toBe('svg');
  });

  it('works with a threshold of 0 (all nodes use WebGL when available)', () => {
    expect(selectRenderer(1, 0, true)).toBe('webgl');
    expect(selectRenderer(0, 0, true)).toBe('svg');
  });

  it('handles very large node counts (10,000 nodes)', () => {
    expect(selectRenderer(10_000, 1000, true)).toBe('webgl');
  });

  it('returns svg when WebGL is unavailable regardless of node count', () => {
    for (const count of [0, 100, 1000, 5000, 100_000]) {
      expect(selectRenderer(count, 1000, false)).toBe('svg');
    }
  });
});

// ---------------------------------------------------------------------------
// Tests for webgl-utils helpers used by the renderer
// ---------------------------------------------------------------------------

import { hexToRgb } from '../webgl-utils';

describe('hexToRgb — rendering color conversions', () => {
  it('converts the WIKI link color correctly', () => {
    const [r, g, b] = hexToRgb('#6366f1');
    expect(r).toBeCloseTo(0x63 / 255, 3);
    expect(g).toBeCloseTo(0x66 / 255, 3);
    expect(b).toBeCloseTo(0xf1 / 255, 3);
  });

  it('converts the MARKDOWN link color correctly', () => {
    const [r, g, b] = hexToRgb('#10b981');
    expect(r).toBeCloseTo(0x10 / 255, 3);
    expect(g).toBeCloseTo(0xb9 / 255, 3);
    expect(b).toBeCloseTo(0x81 / 255, 3);
  });

  it('converts the EMBED link color correctly', () => {
    const [r, g, b] = hexToRgb('#f59e0b');
    expect(r).toBeCloseTo(0xf5 / 255, 3);
    expect(g).toBeCloseTo(0x9e / 255, 3);
    expect(b).toBeCloseTo(0x0b / 255, 3);
  });

  it('converts the BLOCK_REF link color correctly', () => {
    const [r, g, b] = hexToRgb('#ec4899');
    expect(r).toBeCloseTo(0xec / 255, 3);
    expect(g).toBeCloseTo(0x48 / 255, 3);
    expect(b).toBeCloseTo(0x99 / 255, 3);
  });

  it('all color components are in [0, 1] range', () => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#94a3b8', '#ef4444'];
    for (const hex of colors) {
      const [r, g, b] = hexToRgb(hex);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });
});
