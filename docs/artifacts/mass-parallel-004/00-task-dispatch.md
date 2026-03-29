# Mass Parallel 004 - Final Tasks Dispatch

## Task Inventory

### Phase 1: Independent tasks (all run in parallel)

| Task ID        | Title                                  | Agent                           | Domain   |
| -------------- | -------------------------------------- | ------------------------------- | -------- |
| notesaner-cux  | Inline comment display in editor       | senior-frontend-architect       | Frontend |
| notesaner-jbt  | SSR/SSG rendering for public notes     | senior-frontend-architect       | Frontend |
| notesaner-y6lq | Workspace storage quota management     | senior-backend-architect        | Backend  |
| notesaner-w7j  | Note favorites and bookmarks           | senior-frontend-architect       | Frontend |
| notesaner-7og  | Activity feed and change notifications | Full-stack (backend + frontend) | Both     |

### Phase 2: Dependent tasks (after Phase 1)

| Task ID       | Title                       | Depends On    | Agent                     |
| ------------- | --------------------------- | ------------- | ------------------------- |
| notesaner-if7 | OpenGraph and SEO meta tags | notesaner-jbt | senior-frontend-architect |

### Phase 3: Gate + Docs (after Phase 1 + 2)

| Task ID         | Title                            | Notes                 |
| --------------- | -------------------------------- | --------------------- |
| notesaner-08cp  | Gate: All core features complete | Close when P1/P2 done |
| notesaner-aw4u+ | Documentation chain              | Blocked by gate       |

## Dispatch Strategy

- 5 agents in parallel for Phase 1
- 1 agent for Phase 2 (notesaner-if7) after notesaner-jbt completes
- Release validator agent at the end
