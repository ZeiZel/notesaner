/**
 * Vitest configuration for @notesaner/plugin-focus-mode.
 *
 * Uses jsdom so DOM APIs are available for zen-mode CSS injection tests,
 * typewriter scroll calculations, and React component tests.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'plugin-focus-mode',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    globals: false,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/index.ts',
        'src/__tests__/**',
        'src/manifest.json',
      ],
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: '../../coverage/packages/plugin-focus-mode',
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
    },
  },
});
