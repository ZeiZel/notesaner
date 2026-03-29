# Mass Parallel Dispatch 002

## Summary

Batch 2: 10 priority tasks + README, parallelized across 11 agents.
All tasks are P1 unblocked (6uf dependency notesaner-b0u now closed).

## Selected Tasks

### Backend (3 agents)

- Agent 1: notesaner-efkr — Real-time presence cursors in editor
- Agent 2: notesaner-iyfw — User preferences API
- Agent 3: notesaner-6uf — Docker Compose production configuration

### Frontend (5 agents)

- Agent 4: notesaner-9cri — Global keyboard shortcut manager
- Agent 5: notesaner-ofrr + notesaner-cux — Presence indicators + inline comments (related collaboration UI)
- Agent 6: notesaner-jek — Ribbon with quick-action icons
- Agent 7: notesaner-86r — Instant quick capture modal
- Agent 8: notesaner-3ul — Workspace-level search and replace

### QA (1 agent)

- Agent 9: notesaner-pvd — Performance benchmarking

### Docs (1 agent)

- Agent 10: notesaner-ccx — README + self-hosting guide (spec-developer)

## Grouping Rationale

- notesaner-ofrr + notesaner-cux grouped: both are editor collaboration UI components
- All others are independent and run in full parallel

## Post-Execution

- Release Manager: commit + push all changes
