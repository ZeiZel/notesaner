/**
 * Vitest configuration for @notesaner/plugin-web-clipper.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'plugin-web-clipper',
    environment: 'node',
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
        'src/manifest-chrome.json',
      ],
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: '../../coverage/packages/plugin-web-clipper',
      thresholds: {
        lines: 80,
        functions: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@notesaner/contracts': resolve(root, 'libs/contracts/src/index.ts'),
    },
  },
});
