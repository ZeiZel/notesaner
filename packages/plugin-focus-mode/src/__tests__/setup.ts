/**
 * Test setup for @notesaner/plugin-focus-mode.
 *
 * Provides jsdom stubs for browser APIs that are unavailable or incomplete
 * in the test environment.
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// requestAnimationFrame / cancelAnimationFrame
// ---------------------------------------------------------------------------

if (typeof requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(performance.now()), 0) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id);
  };
}

// ---------------------------------------------------------------------------
// window.getSelection stub
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined' && !window.getSelection) {
  window.getSelection = vi.fn(() => null);
}

// ---------------------------------------------------------------------------
// performance.now stub (already available in jsdom, but guard for safety)
// ---------------------------------------------------------------------------

if (typeof performance === 'undefined') {
  globalThis.performance = {
    now: () => Date.now(),
  } as unknown as Performance;
}
