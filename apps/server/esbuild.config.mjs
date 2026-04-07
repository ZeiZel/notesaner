/**
 * esbuild configuration for NestJS server Docker builds.
 *
 * Transpiles TypeScript without type checking (type-check runs separately in CI).
 * This allows Docker builds to succeed even when there are TS errors in
 * non-critical modules (Prisma client out of sync, etc.).
 */
import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find all .ts source files (exclude tests)
const entryPoints = globSync('src/**/*.ts', {
  cwd: __dirname,
  ignore: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
});

await build({
  entryPoints: entryPoints.map((f) => resolve(__dirname, f)),
  outdir: resolve(__dirname, '../../dist/apps/server'),
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  bundle: false,
  // NestJS requires decorators metadata — esbuild handles experimentalDecorators
  tsconfig: resolve(__dirname, 'tsconfig.json'),
});

console.log('Server build completed successfully');
