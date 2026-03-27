// Vitest configuration for @notesaner/server.
// Covers unit and integration tests for the NestJS application.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  test: {
    name: 'server',
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/main.ts',
        'src/**/__tests__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@notesaner/constants': resolve(root, 'libs/constants/src/index.ts'),
      '@notesaner/contracts': resolve(root, 'libs/contracts/src/index.ts'),
      '@notesaner/utils': resolve(root, 'libs/utils/src/index.ts'),
    },
  },
});
