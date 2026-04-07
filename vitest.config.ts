// Root vitest configuration for Notesaner monorepo.
//
// Vitest 4 uses `test.projects` instead of the legacy vitest.workspace.ts.
// Each project references its own vitest.config.ts which defines environment,
// aliases, setup files, and include patterns.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global excludes — prevent scanning git worktrees and build artifacts
    exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**', '**/.next/**', '**/coverage/**'],
    // Workspace projects — each has its own vitest.config.ts
    projects: [
      // Core shared libraries
      'libs/utils/vitest.config.ts',
      'libs/constants/vitest.config.ts',
      'libs/contracts/vitest.config.ts',
      'libs/editor-core/vitest.config.ts',
      'libs/query-factory/vitest.config.ts',
      // Server application
      'apps/server/vitest.config.ts',
      // Web application
      'apps/web/vitest.config.ts',
      // Plugin packages
      'packages/plugin-ai/vitest.config.ts',
      'packages/plugin-calendar/vitest.config.ts',
      'packages/plugin-daily-notes/vitest.config.ts',
      'packages/plugin-database/vitest.config.ts',
      'packages/plugin-excalidraw/vitest.config.ts',
      'packages/plugin-focus-mode/vitest.config.ts',
      'packages/plugin-graph/vitest.config.ts',
      'packages/plugin-kanban/vitest.config.ts',
      'packages/plugin-pdf-export/vitest.config.ts',
      'packages/plugin-slides/vitest.config.ts',
      'packages/plugin-spaced-repetition/vitest.config.ts',
      'packages/plugin-templates/vitest.config.ts',
      'packages/plugin-web-clipper/vitest.config.ts',
    ],
  },
});
