// Vitest configuration for @notesaner/plugin-calendar.
// Tests cover pure utility functions; no DOM environment required.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'plugin-calendar',
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/index.ts',
        'src/sandbox-root.ts',
        'src/**/*.tsx',
      ],
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: '../../coverage/packages/plugin-calendar',
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
      },
    },
  },
  resolve: {
    alias: {
      '@notesaner/contracts': resolve(root, 'libs/contracts/src/index.ts'),
      '@notesaner/plugin-sdk': resolve(root, 'libs/plugin-sdk/src/index.ts'),
      '@notesaner/plugin-calendar': resolve(root, 'packages/plugin-calendar/src/index.ts'),
    },
  },
});
