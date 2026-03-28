# Notesaner — Claude Code Instructions

## Project Overview

Web-first Obsidian alternative. NX monorepo with pnpm.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TipTap, Ant Design, Tailwind CSS 4, Zustand, TanStack Query, axios, Yjs
- **Backend**: NestJS 11, Prisma 6, PostgreSQL 17, ValKey 8
- **Monorepo**: NX 22, pnpm 10
- **Testing**: Vitest, Playwright
- **CI/CD**: GitHub Actions, Docker

## Architecture

- **Frontend**: Feature-Sliced Design (app → pages → widgets → features → entities → shared)
- **Backend**: Clean Architecture (modules → services → repositories)
- **Sync**: Yjs CRDT via WebSocket for real-time collaboration
- **Storage**: MD files on filesystem, metadata in PostgreSQL
- **Plugins**: GitHub-based registry, iframe sandbox, Plugin SDK

## Key Paths

```
apps/web/          — Next.js frontend
apps/server/       — NestJS backend
libs/contracts/    — Shared types, DTOs, API contracts
libs/constants/    — Enums, constants
libs/utils/        — Shared utilities
libs/editor-core/  — TipTap configuration
libs/sync-engine/  — Yjs CRDT logic
libs/markdown/     — MD parser/renderer
libs/plugin-sdk/   — Plugin development SDK
packages/ui/       — Shared UI components (shadcn/ui)
packages/plugin-*/ — Built-in plugins
```

## Coding Standards

- TypeScript strict mode everywhere
- Zod for runtime validation at system boundaries
- Prisma for database access (never raw SQL unless required for FTS)
- Use barrel exports (index.ts) in libs
- Prefix shared packages with `@notesaner/`
- English in code, comments, and commit messages
- Conventional commits (feat:, fix:, chore:, etc.)

## Commands

```bash
pnpm nx serve web          # Start frontend dev server
pnpm nx serve server       # Start backend dev server
pnpm nx test <project>     # Run tests
pnpm nx build <project>    # Build project
pnpm nx lint <project>     # Lint project
pnpm nx affected -t test   # Test only changed projects
pnpm nx graph              # Visualize dependency graph
```

## Frontend Directives (MANDATORY)

> Full spec: `docs/artifacts/fsd-refactor-001/agent-directives.md`

- **Zustand**: business logic ONLY. UI state uses `useState` + React Context
- **Ant Design**: primary UI library. No raw HTML elements — use `Box` component
- **axios**: HTTP client. No native `fetch`. Use query-factory for TanStack Query wrappers
- **useEffect**: minimize. Use TanStack Query for fetching, Zustand for side effects
- **FSD**: `app/` at project root (routing only), `src/` has FSD layers (app, pages, widgets, features, entities, shared)
- **cn()**: single source wrapper for clsx + tailwind-merge in `shared/lib/cn.ts`

## Development Notes

- Notes are stored as MD files on filesystem — the file is source of truth
- Yjs updates are debounced (500ms) before persisting to FS
- Plugin sandbox uses iframes with postMessage API
- Auth supports SAML (Keycloak, Authentik) and OIDC
- i18n: English default, use next-intl for translations
