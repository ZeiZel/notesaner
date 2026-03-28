// Vitest configuration for @notesaner/editor-core.
// Path aliases mirror tsconfig.base.json so that internal imports
// resolve correctly during tests without requiring a full build.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'editor-core',
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
      '@notesaner/utils': resolve(root, 'libs/utils/src/index.ts'),
      '@notesaner/editor-core': resolve(root, 'libs/editor-core/src/index.ts'),
    },
  },
});
