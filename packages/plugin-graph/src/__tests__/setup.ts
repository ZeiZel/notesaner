/**
 * Test setup for @notesaner/plugin-graph.
 *
 * Provides jsdom stubs for browser APIs unavailable in the test environment:
 * - WebGL canvas context (returns a minimal mock)
 * - ResizeObserver
 * - requestAnimationFrame / cancelAnimationFrame
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// ResizeObserver stub
// ---------------------------------------------------------------------------

if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// ---------------------------------------------------------------------------
// requestAnimationFrame stub
// ---------------------------------------------------------------------------

if (typeof requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now()), 0) as unknown as number;
  };
  global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };
}

// ---------------------------------------------------------------------------
// WebGL context stub for HTMLCanvasElement
// ---------------------------------------------------------------------------

const createWebGLContextMock = () => ({
  clearColor: vi.fn(),
  enable: vi.fn(),
  blendFunc: vi.fn(),
  viewport: vi.fn(),
  clear: vi.fn(),
  createShader: vi.fn(() => ({})),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  getShaderInfoLog: vi.fn(() => ''),
  deleteShader: vi.fn(),
  createProgram: vi.fn(() => ({})),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  deleteProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  getProgramInfoLog: vi.fn(() => ''),
  useProgram: vi.fn(),
  createBuffer: vi.fn(() => ({})),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  bufferSubData: vi.fn(),
  deleteBuffer: vi.fn(),
  getAttribLocation: vi.fn(() => 0),
  getUniformLocation: vi.fn(() => ({})),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  uniform1f: vi.fn(),
  uniform2f: vi.fn(),
  uniform4fv: vi.fn(),
  drawArrays: vi.fn(),
  BLEND: 0x0be2,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  COLOR_BUFFER_BIT: 0x4000,
  ARRAY_BUFFER: 0x8892,
  DYNAMIC_DRAW: 0x88e8,
  STATIC_DRAW: 0x88e4,
  FLOAT: 0x1406,
  TRIANGLES: 0x0004,
  LINES: 0x0001,
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  LINK_STATUS: 0x8b82,
  COMPILE_STATUS: 0x8b81,
});

// Patch HTMLCanvasElement.prototype.getContext to return WebGL mock
const originalGetContext = HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.getContext = function (
  contextId: string,
  options?: unknown,
): RenderingContext | null {
  if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
    return createWebGLContextMock() as unknown as WebGLRenderingContext;
  }
  return originalGetContext.call(
    this,
    contextId as '2d',
    options as CanvasRenderingContext2DSettings,
  );
};
