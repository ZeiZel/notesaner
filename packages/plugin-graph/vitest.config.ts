/**
 * Vitest configuration for @notesaner/plugin-graph.
 *
 * Uses jsdom environment since the graph components depend on DOM APIs
 * (canvas, ResizeObserver, requestAnimationFrame).
 * WebGL is tested via stubs — jsdom does not provide a real GPU context.
 *
 * Component rendering tests (GraphView, WebGLGraphView) are excluded since
 * @testing-library/react is not available in this monorepo's root deps.
 * The renderer selection logic and utility functions are fully tested.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'plugin-graph',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
    globals: false,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/index.ts', 'src/__tests__/**'],
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: '../../coverage/packages/plugin-graph',
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@notesaner/contracts': resolve(root, 'libs/contracts/src/index.ts'),
      '@notesaner/constants': resolve(root, 'libs/constants/src/index.ts'),
    },
  },
});
