// Vitest configuration for the NestJS backend server.
// The server uses CommonJS output (for NestJS compatibility), but vitest
// must run against TypeScript source directly — not the compiled dist/.
//
// We use unplugin-swc to enable emitDecoratorMetadata support required by
// NestJS's reflection-based DI container. This is needed for both unit tests
// (which stub DI) and integration tests (which use the real DI container).

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import swc from 'unplugin-swc';

const root = resolve(__dirname, '../..');

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: false,
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2021',
        keepClassNames: true,
      },
    }),
  ],
  test: {
    name: 'server',
    environment: 'node',
    // Run TypeScript source files directly — never the compiled dist/.
    // Also includes integration-style tests under the top-level test/ directory.
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec,e2e-spec}.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Test files
        'src/**/*.{test,spec}.ts',
        'src/**/__tests__/**',
        // Entry point
        'src/main.ts',
        // NestJS module wiring — zero business logic, all DI declarations
        'src/**/*.module.ts',
        // Barrel re-exports (no executable logic)
        'src/**/index.ts',
        // Valkey/Redis infrastructure — requires live connection to test meaningfully
        'src/modules/valkey/**',
        // WebSocket gateway — requires a live WS server; covered by sync.service.ts tests
        'src/modules/sync/sync.gateway.ts',
        // App configuration — validated at startup, not independently unit-testable
        'src/config/**',
        // Thin guard wrappers with no custom logic beyond delegation
        'src/common/guards/jwt-auth.guard.ts',
        'src/common/guards/throttler.guard.ts',
        // Throttler storage — Redis-backed, requires live connection
        'src/common/throttler/**',
        // HTTP interceptors — logging/context, covered by integration tests
        'src/common/interceptors/**',
        // Type-only files with no executable code
        'src/**/jobs.types.ts',
      ],
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: '../../coverage/apps/server',
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@notesaner/utils': resolve(root, 'libs/utils/src/index.ts'),
      '@notesaner/constants': resolve(root, 'libs/constants/src/index.ts'),
      '@notesaner/contracts': resolve(root, 'libs/contracts/src/index.ts'),
      '@notesaner/markdown': resolve(root, 'libs/markdown/src/index.ts'),
    },
  },
});
