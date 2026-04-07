// Vitest configuration for @notesaner/component-sdk.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const monorepoRoot = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    root: __dirname,
    name: 'component-sdk',
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx', 'src/index.ts'],
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: '../../coverage/packages/component-sdk',
    },
  },
  resolve: {
    alias: {
      '@notesaner/contracts': resolve(monorepoRoot, 'libs/contracts/src/index.ts'),
      '@notesaner/constants': resolve(monorepoRoot, 'libs/constants/src/index.ts'),
    },
  },
});
