// Vitest configuration for @notesaner/query-factory.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const monorepoRoot = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    root: __dirname,
    name: 'query-factory',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    passWithNoTests: true,
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx', 'src/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@notesaner/query-factory': resolve(monorepoRoot, 'libs/query-factory/src/index.ts'),
    },
  },
});
