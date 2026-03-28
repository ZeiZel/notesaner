/**
 * Vitest configuration for @notesaner/plugin-ai.
 *
 * Uses jsdom environment because the plugin includes React components and
 * references DOM APIs (fetch, navigator.clipboard, ReadableStream).
 * Fetch is provided by jsdom / node global; streaming tests use mock bodies.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'plugin-ai',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
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
      reportsDirectory: '../../coverage/packages/plugin-ai',
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
