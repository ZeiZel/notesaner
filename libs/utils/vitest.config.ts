// Vitest configuration for @notesaner/utils.
// Path aliases mirror tsconfig.base.json so that internal imports
// (e.g. @notesaner/constants) resolve correctly during tests without
// requiring a full build.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const monorepoRoot = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    root: __dirname,
    name: 'utils',
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
      // Resolve workspace package aliases to their source entry points so
      // that tests run against TypeScript source rather than compiled output.
      '@notesaner/constants': resolve(monorepoRoot, 'libs/constants/src/index.ts'),
      '@notesaner/contracts': resolve(monorepoRoot, 'libs/contracts/src/index.ts'),
      '@notesaner/utils': resolve(monorepoRoot, 'libs/utils/src/index.ts'),
    },
  },
});
