---
title: Frontend Architecture (FSD)
description: Feature-Sliced Design layers — app, pages, widgets, features, entities, shared.
---

# Frontend Architecture (FSD)

The frontend (`apps/web`) follows [Feature-Sliced Design (FSD)](https://feature-sliced.design) — a methodology for structuring scalable React applications.

## Layer Hierarchy

```
apps/web/
├── app/                    # Routing only (Next.js App Router)
│   ├── (auth)/
│   ├── workspace/
│   └── layout.tsx
└── src/
    ├── app/                # Global providers, store setup
    ├── pages/              # Page-level components (assembled from widgets)
    ├── widgets/            # Independent UI blocks (Header, Sidebar, etc.)
    ├── features/           # Business logic slices
    │   ├── editor/         # TipTap editor integration
    │   ├── activity/       # Activity feed
    │   ├── workspace/      # Workspace management
    │   └── component-overrides/
    ├── entities/           # Domain models and their UI
    │   ├── note/
    │   ├── user/
    │   └── workspace/
    └── shared/
        ├── api/            # axios instance, base hooks
        ├── lib/            # cn(), formatDate, etc.
        ├── ui/             # Primitive UI components
        └── types/          # Global type definitions
```

## Key Rules

1. **Import direction**: Higher layers can import from lower layers, never the reverse
   - `pages` can import from `widgets`, `features`, `entities`, `shared`
   - `features` can import from `entities`, `shared` — NOT from `pages` or `widgets`
   - `shared` has no internal imports

2. **State management**:
   - **Zustand**: business/domain state only (auth, workspace, note data)
   - **useState + Context**: UI state (modal open, dropdown, focus)
   - **TanStack Query**: server state (note fetching, caching, mutations)

3. **HTTP**: Always use `axios` via shared api instance. Never use `fetch`.

4. **UI**: Always use Ant Design components. Use `Box` instead of raw `<div>`.

## Feature Slice Structure

Each feature follows a standard internal structure:

```
features/editor/
├── api/            # TanStack Query hooks
│   └── editor.queries.ts
├── hooks/          # Custom React hooks
│   └── useEditorComments.ts
├── lib/            # Pure utilities
│   └── comment-mark.ts
├── model/          # Zustand stores
│   └── editor-store.ts
├── ui/             # React components
│   └── EditorToolbar.tsx
└── index.ts        # Barrel export
```
