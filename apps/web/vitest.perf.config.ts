/**
 * Vitest configuration specifically for performance benchmark tests.
 *
 * This config includes only the `src/__tests__/performance/` directory
 * and outputs results in JSON format for CI regression tracking.
 *
 * Usage:
 *   pnpm vitest run --config apps/web/vitest.perf.config.ts
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'web-perf',
    root: __dirname,
    environment: 'node',
    include: ['src/__tests__/performance/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**'],
    globals: false,
    /* Longer timeout for benchmark iterations */
    testTimeout: 120_000,
    /* Reporter: JSON for CI + verbose for human readability */
    reporters: ['verbose', 'json'],
    outputFile: {
      json: '../../reports/benchmarks/vitest-perf-results.json',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
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
