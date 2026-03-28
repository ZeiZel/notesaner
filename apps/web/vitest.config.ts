// Vitest configuration for the web (Next.js) application.
// Path aliases mirror apps/web/tsconfig.json so that @/* and workspace
// package imports resolve correctly during tests.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'web',
    root: __dirname,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/index.ts', 'src/app/**'],
    },
  },
  resolve: {
    alias: {
      // Next.js-style @ alias
      '@': resolve(__dirname, 'src'),
      // Workspace packages
      '@notesaner/ui': resolve(root, 'packages/ui/src/index.ts'),
      '@notesaner/contracts': resolve(root, 'libs/contracts/src/index.ts'),
      '@notesaner/constants': resolve(root, 'libs/constants/src/index.ts'),
      '@notesaner/utils': resolve(root, 'libs/utils/src/index.ts'),
      '@notesaner/editor-core': resolve(root, 'libs/editor-core/src/index.ts'),
      '@notesaner/sync-engine': resolve(root, 'libs/sync-engine/src/index.ts'),
      '@notesaner/markdown': resolve(root, 'libs/markdown/src/index.ts'),
      '@notesaner/plugin-sdk': resolve(root, 'libs/plugin-sdk/src/index.ts'),
    },
  },
});
