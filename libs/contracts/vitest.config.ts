// Vitest configuration for @notesaner/contracts.
// Contracts depend on constants for shared enums/defaults, so both
// aliases are required to resolve during tests.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const monorepoRoot = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    root: __dirname,
    name: 'contracts',
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    passWithNoTests: true,
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
      '@notesaner/contracts': resolve(monorepoRoot, 'libs/contracts/src/index.ts'),
    },
  },
});
