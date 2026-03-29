---
title: Monorepo Structure (NX)
description: NX workspace layout, project graph, build pipeline, and dependency management.
---

# Monorepo Structure (NX)

Notesaner is an NX 22 monorepo managed with pnpm 10.

## Workspace Layout

```
notesaner/
├── apps/
│   ├── web/                  # Next.js 15 frontend
│   ├── server/               # NestJS 11 backend
│   └── docs/                 # Docusaurus documentation
├── libs/
│   ├── contracts/            # Shared types, DTOs, API contracts
│   ├── constants/            # Enums and constants
│   ├── utils/                # Shared utilities
│   ├── editor-core/          # TipTap configuration
│   ├── sync-engine/          # Yjs CRDT logic
│   ├── markdown/             # MD parser/renderer
│   ├── plugin-sdk/           # Plugin development SDK
│   └── query-factory/        # TanStack Query wrappers
├── packages/
│   ├── ui/                   # Shared UI components (shadcn/ui)
│   ├── component-sdk/        # Component override SDK
│   ├── plugin-excalidraw/    # Built-in Excalidraw plugin
│   ├── plugin-kanban/        # Built-in Kanban plugin
│   └── plugin-*/             # Other built-in plugins
├── nx.json                   # NX configuration
├── tsconfig.base.json        # Shared TypeScript paths
├── pnpm-workspace.yaml       # pnpm workspace packages
└── package.json              # Root package.json
```

## NX Project Graph

Run `pnpm nx graph` to visualize the dependency graph. Key dependencies:

- `web` depends on: `contracts`, `ui`, `editor-core`, `sync-engine`, `query-factory`, all `plugin-*`
- `server` depends on: `contracts`, `constants`, `utils`, `markdown`, `sync-engine`
- `libs` have no circular dependencies (enforced by NX)

## Build Pipeline

```bash
# Build affected projects only (CI)
pnpm nx affected -t build

# Build specific project
pnpm nx build web
pnpm nx build server

# Test affected projects
pnpm nx affected -t test

# Lint all
pnpm nx run-many -t lint
```

## Caching

NX caches build, test, and lint results. On CI, Nx Cloud is used for distributed caching.

To clear local cache:

```bash
pnpm nx reset
```

## Tags

Projects are tagged for dependency enforcement:

- `type:app` — application (web, server, docs)
- `type:lib` — library (libs/\*)
- `type:ui` — UI component library
- `scope:web` — web-only
- `scope:server` — server-only
- `scope:shared` — used by both
