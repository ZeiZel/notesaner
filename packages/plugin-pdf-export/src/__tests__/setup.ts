/**
 * Test setup for @notesaner/plugin-pdf-export.
 *
 * Fixes Node.js >= 22 localStorage incompatibility with jsdom.
 */

// ---------------------------------------------------------------------------
// localStorage fix for Node.js >= 22
//
// Node.js 22+ defines a `localStorage` getter on globalThis that returns a
// broken Storage-like object (no getItem/setItem/clear methods). vitest's
// populateGlobal() skips it because it already exists. Replace with polyfill.
// ---------------------------------------------------------------------------

if (typeof localStorage !== 'undefined' && typeof localStorage.clear !== 'function') {
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
