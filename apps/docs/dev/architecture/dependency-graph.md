---
title: Dependency Graph
description: NX project dependency graph, build order, and affected computation.
---

# Dependency Graph

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Visualizing the Graph

```bash
pnpm nx graph
```

This opens an interactive dependency graph in the browser showing all projects and their dependencies.

## Key Dependencies

```
web ──────────────────────────────► contracts
web ──────────────────────────────► ui
web ──────────────────────────────► editor-core
web ──────────────────────────────► sync-engine
web ──────────────────────────────► query-factory
web ──────────────────────────────► plugin-*

server ───────────────────────────► contracts
server ───────────────────────────► constants
server ───────────────────────────► utils
server ───────────────────────────► markdown

editor-core ──────────────────────► (external: TipTap, Yjs)
sync-engine ──────────────────────► (external: Yjs)
```

## Dependency Rules

NX enforces dependency boundaries via tags in `project.json`:

- `scope:server` projects cannot import from `scope:web`
- `scope:web` projects cannot import from `scope:server`
- `type:lib` projects can be imported by any `type:app`
