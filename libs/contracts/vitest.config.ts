// Vitest configuration for @notesaner/contracts.
// Contracts depend on constants for shared enums/defaults, so both
// aliases are required to resolve during tests.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'contracts',
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
      '@notesaner/constants': resolve(root, 'libs/constants/src/index.ts'),
      '@notesaner/contracts': resolve(root, 'libs/contracts/src/index.ts'),
    },
  },
});
