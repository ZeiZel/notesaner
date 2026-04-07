// Vitest configuration for @notesaner/constants.
// This library has no external workspace dependencies so the alias map
// only includes itself for completeness (e.g. if tests use barrel imports).

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const monorepoRoot = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    root: __dirname,
    name: 'constants',
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@notesaner/constants': resolve(monorepoRoot, 'libs/constants/src/index.ts'),
    },
  },
});
