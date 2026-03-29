# Mass Parallel Dispatch Plan

## Summary

50 open tasks, 47 immediately unblocked, 3 with dependency chains.
Goal: Parallel execution across 30 agent groups, then release-manager commit+push.

## Blocked Tasks (execute after dependency completes)

- notesaner-if7 (OG tags) <- blocked by notesaner-jbt (SSR/SSG)
- notesaner-ano2 (preferences panel) <- blocked by notesaner-aefl (MD preview)
- notesaner-vidn (notification UI) <- blocked by notesaner-k3qp (email notifications)

## Agent Groups

### GROUP 1: Editor Extensions (3 agents)

- Agent 1: notesaner-aefl + notesaner-nbgm (MD preview + block references)
- Agent 2: notesaner-5aip + notesaner-unxp + notesaner-j667 (toggle list + heading fold + text highlight)
- Agent 3: notesaner-z4c8 (vim keybinding mode)

### GROUP 2: Workspace UI (4 agents)

- Agent 4: notesaner-gciy + notesaner-jek + notesaner-8w8y (tab bar + ribbon + panel controls)
- Agent 5: notesaner-qjg + notesaner-l1q1 + notesaner-v74k (drag-drop import + duplicate + drag organize)
- Agent 6: notesaner-i6j4 (template system UI)
- Agent 7: notesaner-cfj5 + notesaner-djq5 (public nav + onboarding)

### GROUP 3: Frontend Features (5 agents)

- Agent 8: notesaner-ofrr + notesaner-cux (presence indicators + inline comments)
- Agent 9: notesaner-r0x + notesaner-ccc2 + notesaner-dqeb (version diff + saved searches + graph filtering)
- Agent 10: notesaner-9cri (keyboard shortcut manager)
- Agent 11: notesaner-kusu (theming/custom CSS)
- Agent 12: notesaner-tdo1 + notesaner-dbga (undo/redo toolbar + copy-to-clipboard)

### GROUP 4: Backend (7 agents)

- Agent 13: notesaner-efkr (real-time presence cursors)
- Agent 14: notesaner-iyfw (user preferences API)
- Agent 15: notesaner-89hf (API key management)
- Agent 16: notesaner-k3qp (email notification system)
- Agent 17: notesaner-5hgg + notesaner-g69k (GitHub release download + plugin hot-reload)
- Agent 18: notesaner-ho0v + notesaner-5cgb (migration strategy + seed data)
- Agent 19: notesaner-jnwd (CDN/caching strategy)

### GROUP 5: Publishing (1 agent, sequential internally)

- Agent 20: notesaner-jbt then notesaner-if7 (SSR/SSG then OG tags)

### GROUP 6: Advanced Features (3 agents)

- Agent 21: notesaner-5wi + notesaner-4wq (sharing + multi-workspace)
- Agent 22: notesaner-3ul + notesaner-86r (search/replace + quick capture)
- Agent 23: notesaner-jze + notesaner-a6x (export + import wizard)

### GROUP 7: DevOps (1 agent)

- Agent 24: notesaner-6uf (Docker Compose production)

### GROUP 8: QA (3 agents)

- Agent 25: notesaner-gv0 (accessibility tests)
- Agent 26: notesaner-d96 (security audit checklist)
- Agent 27: notesaner-pvd (performance benchmarking)

### GROUP 9: Documentation (1 agent)

- Agent 28: notesaner-6ly + notesaner-ccx (plugin dev guide + self-hosting guide)

### GROUP 10: Storybook + Notification UI + Settings (2 agents)

- Agent 29: notesaner-nu9r (Storybook)
- Agent 30: notesaner-ano2 + notesaner-vidn (blocked - execute after deps complete)

## Post-Execution

- Release Manager: git add, commit (conventional commits), push all changes
