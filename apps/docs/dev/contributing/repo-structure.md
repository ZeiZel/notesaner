---
title: Repository Structure (NX Monorepo)
description: Overview of the NX monorepo layout and where to find things.
---

# Repository Structure

See [Monorepo Structure (NX)](/docs/architecture/monorepo) for the full architecture documentation.

## Quick Reference

| Path                 | Contents                             |
| -------------------- | ------------------------------------ |
| `apps/web/`          | Next.js 15 frontend                  |
| `apps/server/`       | NestJS 11 backend                    |
| `apps/docs/`         | This documentation site (Docusaurus) |
| `libs/contracts/`    | Shared DTOs and TypeScript types     |
| `libs/editor-core/`  | TipTap editor configuration          |
| `libs/sync-engine/`  | Yjs CRDT sync implementation         |
| `libs/plugin-sdk/`   | Plugin development SDK               |
| `packages/ui/`       | Shared React component library       |
| `packages/plugin-*/` | Built-in plugins                     |

## Finding Code

```bash
# Find a specific file
pnpm nx list                      # List all projects

# Search across the codebase
grep -r "functionName" apps/      # Find in apps
grep -r "className" libs/         # Find in libs
```

## Branching Strategy

- `main` — production-ready code
- `develop` — integration branch
- `feat/...` — feature branches
- `fix/...` — bug fix branches
- `chore/...` — tooling, deps, docs
