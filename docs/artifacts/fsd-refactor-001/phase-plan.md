# FSD Refactoring Phase Plan

## Overview

Full refactoring of `apps/web/` to comply with Feature-Sliced Design, migrate UI to Ant Design, enforce state management rules, and establish proper abstraction layers.

## Phase 0: Gate (Sequential, MUST pass first)

| Task ID        | Title                         | Parallel Group |
| -------------- | ----------------------------- | -------------- |
| notesaner-ok7k | Playwright e2e baseline tests | Solo           |
| notesaner-htwo | Agent directives/specs        | Solo (DONE)    |

**Exit criteria**: All existing user flows covered by Playwright tests, tests pass.

## Phase 1: Infrastructure (Parallelizable)

All tasks in this phase can run in parallel after Phase 0 gate passes.

| Task ID        | Title                        | Agent Type               | Parallel Group |
| -------------- | ---------------------------- | ------------------------ | -------------- |
| notesaner-3ikd | Install Ant Design + theme   | react-developer          | A              |
| notesaner-d96y | Replace fetch with axios     | nodejs-developer         | A              |
| notesaner-ojrn | Create Box component         | react-developer          | A              |
| notesaner-kskp | Create query-factory package | senior-backend-architect | A              |
| notesaner-onfj | Consolidate cn() wrapper     | react-developer          | A              |

**Exit criteria**: All infra packages installed, configured, and tested independently.

## Phase 2: Structural (Sequential — critical path)

| Task ID        | Title                                              | Agent Type                | Parallel Group |
| -------------- | -------------------------------------------------- | ------------------------- | -------------- |
| notesaner-agol | FSD restructuring (app/ → root, src/ → FSD layers) | senior-frontend-architect | Solo           |

**Exit criteria**: Directory structure matches FSD spec, Next.js routing works from root app/, all imports updated.

## Phase 3: Migration (Parallelizable by feature)

| Task ID        | Title                         | Agent Type      | Parallel Group |
| -------------- | ----------------------------- | --------------- | -------------- |
| notesaner-cdyd | Migrate shared layer          | react-developer | B (first)      |
| notesaner-intl | Migrate workspace feature     | react-developer | C              |
| notesaner-69jq | Migrate editor feature        | react-developer | C              |
| notesaner-tby5 | Migrate settings feature      | react-developer | C              |
| notesaner-o3er | Migrate publish/plugins/admin | react-developer | C              |
| notesaner-87qq | Zustand audit                 | react-developer | C              |
| notesaner-a3hk | useEffect audit               | react-developer | C              |

**Note**: Group B (shared) must complete before Group C can start. Group C tasks are all parallelizable.

**Exit criteria**: All components use Ant Design + Box, all API calls use axios + query-factory, Zustand contains only business logic.

## Phase 4: Verification Gate (Sequential)

| Task ID        | Title                             | Agent Type  | Parallel Group |
| -------------- | --------------------------------- | ----------- | -------------- |
| notesaner-4r1a | Final Playwright e2e verification | spec-tester | Solo           |

**Exit criteria**: ALL baseline tests pass. Zero regressions.

## Dependency Graph

```
Phase 0 (Gate)
  notesaner-ok7k (Playwright baseline)
  notesaner-htwo (Specs) ✅ DONE
       |
       v
Phase 1 (Infra — parallel)
  notesaner-3ikd (Ant Design)
  notesaner-d96y (Axios)
  notesaner-ojrn (Box)
  notesaner-kskp (Query Factory)
  notesaner-onfj (cn())
       |
       v
Phase 2 (FSD restructure — sequential)
  notesaner-agol (move app/, create FSD layers)
       |
       +---> notesaner-87qq (Zustand audit) ──┐
       +---> notesaner-a3hk (useEffect audit) ┤
       |                                       |
       v                                       |
Phase 3 (Migration)                           |
  notesaner-cdyd (shared layer) ──┐            |
       |                          |            |
       v                          |            |
  notesaner-intl (workspace) ─────┤            |
  notesaner-69jq (editor) ────────┤            |
  notesaner-tby5 (settings) ──────┤            |
  notesaner-o3er (publish/etc) ───┤            |
       |                          |            |
       v                          v            v
Phase 4 (Final Gate)
  notesaner-4r1a (Playwright verification)
```

## Agent Assignment for Parallel Execution

### Wave 1 (after gate): 5 agents in parallel

- Agent 1 (react-developer): notesaner-3ikd (Ant Design)
- Agent 2 (nodejs-developer): notesaner-d96y (axios)
- Agent 3 (react-developer): notesaner-ojrn (Box component)
- Agent 4 (senior-backend-architect): notesaner-kskp (query-factory)
- Agent 5 (react-developer): notesaner-onfj (cn() consolidation)

### Wave 2 (after infra): 1 agent

- Agent 1 (senior-frontend-architect): notesaner-agol (FSD restructuring)

### Wave 3 (after FSD): 1 agent first, then 6 in parallel

- Agent 1 (react-developer): notesaner-cdyd (shared layer)
- Then parallel:
  - Agent 2-5 (react-developer): feature migrations
  - Agent 6 (react-developer): Zustand audit
  - Agent 7 (react-developer): useEffect audit

### Wave 4 (after all): 1 agent

- Agent 1 (spec-tester): notesaner-4r1a (final verification)
