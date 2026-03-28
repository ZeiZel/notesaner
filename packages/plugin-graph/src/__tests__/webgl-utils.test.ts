/**
 * Tests for webgl-utils.ts
 *
 * These tests run in jsdom which does not support real WebGL.
 * We verify utility functions (color conversion, shader source format,
 * capability detection fallback) without requiring a GPU.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  hexToRgb,
  isWebGLSupported,
  NODE_VERT_SHADER,
  NODE_FRAG_SHADER,
  EDGE_VERT_SHADER,
  EDGE_FRAG_SHADER,
} from '../webgl-utils';

// ---------------------------------------------------------------------------
// hexToRgb
// ---------------------------------------------------------------------------

describe('hexToRgb', () => {
  it('parses a 6-digit hex color to normalized floats', () => {
    const [r, g, b] = hexToRgb('#ffffff');
    expect(r).toBeCloseTo(1.0);
    expect(g).toBeCloseTo(1.0);
    expect(b).toBeCloseTo(1.0);
  });

  it('parses black correctly', () => {
    const [r, g, b] = hexToRgb('#000000');
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('parses indigo #6366f1 correctly', () => {
    const [r, g, b] = hexToRgb('#6366f1');
    expect(r).toBeCloseTo(0x63 / 255);
    expect(g).toBeCloseTo(0x66 / 255);
    expect(b).toBeCloseTo(0xf1 / 255);
  });

  it('parses shorthand 3-digit hex', () => {
    const [r, g, b] = hexToRgb('#fff');
    expect(r).toBeCloseTo(1.0);
    expect(g).toBeCloseTo(1.0);
    expect(b).toBeCloseTo(1.0);
  });

  it('parses shorthand #f00 as red', () => {
    const [r, g, b] = hexToRgb('#f00');
    expect(r).toBeCloseTo(1.0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('returns slate fallback for invalid input', () => {
    const [r, g, b] = hexToRgb('invalid');
    expect(r).toBeCloseTo(0.58);
    expect(g).toBeCloseTo(0.64);
    expect(b).toBeCloseTo(0.73);
  });

  it('returns cached result on repeated calls', () => {
    const first = hexToRgb('#6366f1');
    const second = hexToRgb('#6366f1');
    expect(first).toBe(second); // same array reference due to cache
  });
});

// ---------------------------------------------------------------------------
// isWebGLSupported
// ---------------------------------------------------------------------------

describe('isWebGLSupported', () => {
  it('returns false when getContext throws', () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementationOnce((tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: () => {
            throw new Error('WebGL not supported');
          },
        } as unknown as HTMLElement;
      }
      return originalCreateElement(tag);
    });

    expect(isWebGLSupported()).toBe(false);
  });

  it('returns false when getContext returns null for all contexts', () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementationOnce((tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: () => null,
        } as unknown as HTMLElement;
      }
      return originalCreateElement(tag);
    });

    expect(isWebGLSupported()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Shader sources
// ---------------------------------------------------------------------------

describe('GLSL shader sources', () => {
  it('NODE_VERT_SHADER references expected attributes', () => {
    expect(NODE_VERT_SHADER).toContain('aPosition');
    expect(NODE_VERT_SHADER).toContain('aNodePos');
    expect(NODE_VERT_SHADER).toContain('aRadius');
    expect(NODE_VERT_SHADER).toContain('aColor');
    expect(NODE_VERT_SHADER).toContain('uTransform');
    expect(NODE_VERT_SHADER).toContain('uResolution');
  });

  it('NODE_FRAG_SHADER contains SDF circle logic', () => {
    expect(NODE_FRAG_SHADER).toContain('length(vOffset)');
    expect(NODE_FRAG_SHADER).toContain('smoothstep');
    expect(NODE_FRAG_SHADER).toContain('uOpacity');
    expect(NODE_FRAG_SHADER).toContain('uHighlight');
    expect(NODE_FRAG_SHADER).toContain('uHovered');
  });

  it('EDGE_VERT_SHADER references expected attributes', () => {
    expect(EDGE_VERT_SHADER).toContain('aPos');
    expect(EDGE_VERT_SHADER).toContain('aColor');
    expect(EDGE_VERT_SHADER).toContain('aOpacity');
    expect(EDGE_VERT_SHADER).toContain('uTransform');
  });

  it('EDGE_FRAG_SHADER outputs the edge color', () => {
    expect(EDGE_FRAG_SHADER).toContain('vColor');
    expect(EDGE_FRAG_SHADER).toContain('vOpacity');
    expect(EDGE_FRAG_SHADER).toContain('gl_FragColor');
  });

  it('all shaders begin with precision mediump float', () => {
    for (const src of [NODE_VERT_SHADER, NODE_FRAG_SHADER, EDGE_VERT_SHADER, EDGE_FRAG_SHADER]) {
      expect(src.trim()).toMatch(/^precision mediump float/);
    }
  });
});
