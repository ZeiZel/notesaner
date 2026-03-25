# Notesaner — Architecture Overview

## Vision

Web-first, self-hostable note-taking platform inspired by Obsidian (UI/UX), Notesnook (server model), and Affine (block editor + whiteboard). Full real-time collaboration, plugin ecosystem, Zettelkasten support, and public publishing.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Web App  │  │ Desktop  │  │  Public  │                   │
│  │ (Next.js)│  │(Electron)│  │  Viewer  │                   │
│  │          │  │ (planned)│  │ (SSR/SSG)│                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │              │              │                        │
│       └──────────────┼──────────────┘                        │
│                      │                                       │
│            ┌─────────▼──────────┐                            │
│            │   Yjs WebSocket    │  ← CRDT real-time sync     │
│            │   (y-websocket)    │                             │
│            └─────────┬──────────┘                            │
└──────────────────────┼──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    API SERVER (NestJS)                        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │  Notes   │  │ Plugins  │  │ Publish  │    │
│  │ Module   │  │  Module  │  │  Module  │  │  Module  │    │
│  │          │  │          │  │          │  │          │     │
│  │ SAML     │  │ CRUD     │  │ Registry │  │ SSG      │    │
│  │ OIDC     │  │ Search   │  │ Install  │  │ Themes   │    │
│  │ Keycloak │  │ Versions │  │ Sandbox  │  │ Routing  │    │
│  │ Authentik│  │ Tags     │  │          │  │          │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │              │              │          │
│  ┌────▼──────────────▼──────────────▼──────────────▼─────┐  │
│  │                  Shared Services                       │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────────┐  │  │
│  │  │ Prisma │  │ ValKey │  │  File  │  │   BullMQ   │  │  │
│  │  │  ORM   │  │ Cache  │  │Storage │  │   Queues   │  │  │
│  │  └───┬────┘  └───┬────┘  └───┬────┘  └─────┬──────┘  │  │
│  └──────┼───────────┼───────────┼──────────────┼─────────┘  │
└─────────┼───────────┼───────────┼──────────────┼────────────┘
          │           │           │              │
    ┌─────▼──┐  ┌─────▼──┐  ┌────▼─────┐  ┌────▼─────┐
    │Postgres│  │ ValKey │  │   File   │  │  ValKey  │
    │   17   │  │   8    │  │  System  │  │  (Queue) │
    │        │  │(cache) │  │  (MD)    │  │          │
    └────────┘  └────────┘  └──────────┘  └──────────┘
```

## NX Monorepo Structure

```
notesaner/
├── apps/
│   ├── web/                    # Next.js 15 web application
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   ├── features/       # Feature modules (FSD)
│   │   │   │   ├── editor/     # Note editor
│   │   │   │   ├── graph/      # Knowledge graph
│   │   │   │   ├── sidebar/    # File explorer, search
│   │   │   │   ├── workspace/  # Window management, layouts
│   │   │   │   ├── auth/       # Login, SSO
│   │   │   │   ├── settings/   # User/app settings
│   │   │   │   └── publish/    # Public view configuration
│   │   │   ├── entities/       # Domain entities (FSD)
│   │   │   ├── shared/         # Shared utilities (FSD)
│   │   │   └── widgets/        # Composite UI blocks (FSD)
│   │   └── public/
│   │
│   ├── server/                 # NestJS API + WebSocket server
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/       # SAML, OIDC, Keycloak, Authentik
│   │   │   │   ├── notes/      # Note CRUD, versioning, search
│   │   │   │   ├── files/      # File system operations
│   │   │   │   ├── sync/       # Yjs WebSocket provider
│   │   │   │   ├── plugins/    # Plugin registry, installation
│   │   │   │   ├── publish/    # Public note serving
│   │   │   │   ├── users/      # User management
│   │   │   │   └── workspaces/ # Multi-tenant workspaces
│   │   │   ├── common/         # Guards, interceptors, filters
│   │   │   └── config/         # Environment, database config
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   │
│   └── desktop/                # Electron (planned, deferred)
│
├── libs/
│   ├── contracts/              # Shared types, DTOs, API contracts
│   │   ├── src/
│   │   │   ├── notes/          # Note-related types
│   │   │   ├── auth/           # Auth types
│   │   │   ├── plugins/        # Plugin types
│   │   │   ├── sync/           # Sync protocol types
│   │   │   └── api/            # API route definitions
│   │   └── index.ts
│   │
│   ├── constants/              # Shared constants, enums
│   ├── utils/                  # Shared utilities
│   ├── editor-core/            # TipTap config + custom extensions
│   ├── sync-engine/            # Yjs CRDT logic (client+server)
│   ├── markdown/               # MD parser, Zettelkasten links
│   └── plugin-sdk/             # Plugin development SDK
│
├── packages/
│   ├── ui/                     # shadcn/ui shared components
│   ├── plugin-excalidraw/      # Excalidraw whiteboard
│   ├── plugin-kanban/          # Kanban boards
│   ├── plugin-calendar/        # Calendar view
│   ├── plugin-database/        # Notion-like databases
│   ├── plugin-graph/           # Knowledge graph
│   ├── plugin-slides/          # Presentations
│   ├── plugin-ai/              # AI assistant
│   ├── plugin-templates/       # Note templates
│   ├── plugin-backlinks/       # Backlinks & unlinked mentions
│   ├── plugin-daily-notes/     # Daily/periodic notes
│   └── plugin-pdf-export/      # PDF/DOCX export
│
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.server
│   └── docker-compose.yml
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint, test, build
│       ├── release.yml         # Docker build + push
│       └── deploy.yml          # Deploy to staging/prod
│
├── nx.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Key Architectural Decisions

### 1. Backend: NestJS over Go

**Decision**: NestJS (TypeScript)

**Rationale**:
- Full TypeScript monorepo — shared types between frontend and backend via `libs/contracts`
- TipTap/ProseMirror and Yjs are JS/TS ecosystem — native integration
- NestJS has excellent WebSocket support (needed for Yjs collaboration)
- Prisma ORM works natively with TypeScript
- Plugin system needs to load JS modules — easier in Node.js
- Go would require maintaining two separate type systems and a gRPC/REST bridge

### 2. File System for Note Storage

**Decision**: Store MD files on filesystem, metadata in PostgreSQL

**Rationale**:
- Admin can access notes directly via filesystem (requirement)
- Compatible with git-based backup/versioning
- Easy migration from/to Obsidian (same format)
- PostgreSQL stores: metadata, tags, links, user settings, permissions
- File watcher detects external changes and syncs to DB

### 3. CRDT (Yjs) for Real-Time Sync

**Decision**: Yjs with y-websocket provider

**Rationale**:
- Conflict-free merging without server arbitration
- Offline-first: edits queue locally, merge on reconnect
- TipTap has native Yjs binding (@tiptap/extension-collaboration)
- Supports cursors and presence (@tiptap/extension-collaboration-cursor)
- Same engine works for Electron offline mode (future)

### 4. Plugin Architecture

**Decision**: GitHub-based registry with sandboxed execution

**Architecture**:
```
Plugin Manifest (manifest.json in GitHub repo)
    │
    ▼
Plugin Registry (server-side catalog with tags)
    │
    ▼
Plugin Loader (client-side, downloads from GitHub releases)
    │
    ▼
Plugin Sandbox (iframe or Shadow DOM for isolation)
    │
    ▼
Plugin API (SDK exposes editor, workspace, settings hooks)
```

Each plugin provides:
- `manifest.json` — name, version, tags, permissions, entry points
- `main.js` — plugin logic (uses Plugin SDK)
- `styles.css` — optional styles (scoped)
- `settings.json` — configurable settings schema

Tags system for search: `["notesaner-plugin", "editor", "whiteboard"]`

### 5. Window Management

**Decision**: dnd-kit based tiling window manager

**Approach**:
- Split panes (horizontal/vertical) like Obsidian
- Snap zones on drag (like Windows 11 Snap Layouts)
- Predefined layout templates (2-column, 3-column, grid, etc.)
- Persistent layout state per workspace
- Floating windows for secondary content (settings, graph)

## Data Model (Core)

```
User ──┬── Workspace ──┬── Note ──┬── NoteVersion
       │               │          ├── NoteLink (→ Note)
       │               │          ├── Tag
       │               │          └── Attachment
       │               │
       │               ├── Layout
       │               │   └── Panel[]
       │               │
       │               └── PluginSettings
       │
       ├── Session
       └── AuthProvider (SAML/OIDC config)

Plugin ──┬── PluginManifest
         ├── PluginRelease
         └── PluginReview
```

## Authentication Flow

```
                    ┌──────────────┐
                    │   Login Page │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
        │   SAML    │ │ OIDC   │ │  Local   │
        │(Keycloak) │ │(Generic│ │ (email/  │
        │(Authentik)│ │ OIDC)  │ │ password)│
        └─────┬─────┘ └───┬────┘ └────┬─────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼───────┐
                    │  JWT Token   │
                    │  (access +   │
                    │   refresh)   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Authorized  │
                    │   Session    │
                    └──────────────┘
```

## Real-Time Sync Architecture

```
Client A                Server (Yjs Provider)           Client B
   │                          │                            │
   │── Yjs Update ──────────►│                            │
   │                          │── Broadcast Update ──────►│
   │                          │                            │
   │                          │── Persist to FS ─────► MD File
   │                          │── Update metadata ──► PostgreSQL
   │                          │                            │
   │◄── Awareness Update ────│── Awareness Update ──────►│
   │  (cursors, presence)     │  (cursors, presence)       │
```

**Sync flow**:
1. Client edits note → Yjs generates update
2. Update sent via WebSocket to server
3. Server broadcasts to other clients in same document
4. Server debounces and persists Yjs doc state → MD file
5. Server updates metadata (last modified, word count) → PostgreSQL

## Publishing Architecture

```
Admin configures:
  "Publish vault X as public at /docs"
       │
       ▼
  Server generates static pages (ISR/SSG)
       │
       ▼
  Public visitors see read-only rendered notes
  - No auth required
  - SEO-friendly (SSR)
  - Custom themes
  - Navigation auto-generated from folder structure
```

## Security Model

- **Plugin sandbox**: Plugins run in iframes with postMessage API, no direct DOM access
- **CSP headers**: Strict Content Security Policy for plugin isolation
- **Auth tokens**: Short-lived JWT access + long-lived refresh tokens in httpOnly cookies
- **File access**: Server validates paths to prevent directory traversal
- **RBAC**: Admin, Editor, Viewer roles per workspace
- **Rate limiting**: API rate limiting via ValKey

## Performance Strategy

- **Editor**: Virtual rendering for large documents (ProseMirror viewport)
- **Graph**: WebGL rendering (Force Graph) for large vaults (1000+ notes)
- **Search**: PostgreSQL FTS with GIN indexes, trigram similarity for fuzzy search
- **Caching**: ValKey for session, search results, rendered public pages
- **Assets**: CDN-ready static assets, lazy loading for attachments
- **Bundle**: Code splitting per feature, dynamic imports for plugins
