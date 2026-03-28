/**
 * Vitest configuration for @notesaner/plugin-pdf-export.
 *
 * Uses jsdom environment since the export components depend on DOM APIs
 * (document.createElement, localStorage, URL.createObjectURL, etc.).
 *
 * The fflate zip library requires TextEncoder which is available in jsdom.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'plugin-pdf-export',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/index.ts',
        'src/__tests__/**',
        'src/manifest.json',
      ],
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: '../../coverage/packages/plugin-pdf-export',
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@notesaner/contracts': resolve(root, 'libs/contracts/src/index.ts'),
      '@notesaner/plugin-sdk': resolve(root, 'libs/plugin-sdk/src/index.ts'),
    },
  },
});
