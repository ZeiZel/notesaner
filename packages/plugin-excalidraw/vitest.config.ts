/**
 * Vitest configuration for @notesaner/plugin-excalidraw.
 *
 * Uses jsdom environment since the plugin interacts with DOM APIs.
 * @excalidraw/excalidraw is mocked to avoid loading the full canvas library
 * in unit tests (it requires a real browser environment).
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'plugin-excalidraw',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/index.ts', 'src/__tests__/**'],
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: '../../coverage/packages/plugin-excalidraw',
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
      '@notesaner/plugin-sdk': resolve(root, 'libs/plugin-sdk/src/index.ts'),
      '@notesaner/editor-core': resolve(root, 'libs/editor-core/src/index.ts'),
      // Mock the heavy Excalidraw library in unit tests
      '@excalidraw/excalidraw': resolve(
        root,
        'packages/plugin-excalidraw/src/__tests__/__mocks__/excalidraw.ts',
      ),
    },
  },
});
