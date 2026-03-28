/**
 * Vitest configuration for @notesaner/plugin-spaced-repetition.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'plugin-spaced-repetition',
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/index.ts', 'src/__tests__/**'],
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: '../../coverage/packages/plugin-spaced-repetition',
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
