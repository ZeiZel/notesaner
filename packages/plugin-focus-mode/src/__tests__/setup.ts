/**
 * Test setup for @notesaner/plugin-focus-mode.
 *
 * Provides jsdom stubs for browser APIs that are unavailable or incomplete
 * in the test environment.
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// localStorage fix for Node.js >= 22
//
// Node.js 22+ defines a `localStorage` getter on globalThis that returns a
// broken Storage-like object (no getItem/setItem/clear methods). When vitest
// sets up the jsdom environment via populateGlobal(), it skips properties
// already present on global. Since Node.js defines `localStorage`, jsdom's
// proper Storage never replaces it.
//
// Fix: Create a proper in-memory Storage polyfill that replaces the broken
// Node.js localStorage with a fully-functional implementation.
// ---------------------------------------------------------------------------

if (typeof localStorage !== 'undefined' && typeof localStorage.clear !== 'function') {
  // Node.js 22+ broken localStorage detected — replace with polyfill
  const store = new Map<string, string>();
  const storage = {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    key(index: number): string | null {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
    get length(): number {
      return store.size;
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

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
