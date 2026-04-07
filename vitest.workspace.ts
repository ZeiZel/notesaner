// Vitest workspace configuration.
// Lists every project config EXPLICITLY to prevent vitest from discovering
// duplicate configs in .claude/worktrees/ (git worktrees).

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
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
  // SDK packages
  'packages/component-sdk/vitest.config.ts',
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
]);
