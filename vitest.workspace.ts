// Vitest workspace configuration.
// Registers every project that has its own vitest.config.ts so that
// `vitest run` from the root runs all project test suites in one pass.
// NX's `nx affected -t test` will still scope runs to changed projects.

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Core shared libraries
  'libs/utils/vitest.config.ts',
  'libs/constants/vitest.config.ts',
  'libs/contracts/vitest.config.ts',
  // Applications
  'apps/server/vitest.config.ts',
]);
