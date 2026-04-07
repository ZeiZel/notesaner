# Test Fix Context

## Failing Projects (6 total)

### Issue 1: "No test files found" (5 projects)

vitest exits with code 1 when no test files match the include pattern.
Fix: add `--passWithNoTests` flag to vitest command in project.json.

Projects:

- libs/contracts/project.json
- libs/constants/project.json
- libs/utils/project.json
- packages/plugin-graph/project.json
- libs/query-factory/project.json

### Issue 2: Missing vitest config (1 project)

component-sdk uses deprecated `@nx/vite:test` executor and has no vitest.config.ts.
Fix: create vitest.config.ts and update project.json to use `nx:run-commands`.

Project: packages/component-sdk/project.json
