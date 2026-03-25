# Notesaner — Implementation Plan

## Phase 0: Project Foundation (Week 1)

### 0.1 NX Monorepo Setup
- [ ] Initialize NX workspace with pnpm
- [ ] Configure `tsconfig.base.json` with path aliases
- [ ] Set up `pnpm-workspace.yaml`
- [ ] Configure ESLint 9 flat config
- [ ] Configure Prettier
- [ ] Set up Husky + Commitlint
- [ ] Configure Vitest for unit testing
- [ ] Create `libs/contracts`, `libs/constants`, `libs/utils`

### 0.2 DevOps Foundation
- [ ] Initialize git repository
- [ ] Create `.gitignore`
- [ ] Create Docker Compose for local dev (PostgreSQL, ValKey)
- [ ] Create GitHub Actions CI workflow (lint, test, build)
- [ ] Create `Dockerfile.web` and `Dockerfile.server`
- [ ] Set up GitHub Container Registry

### 0.3 Core Libraries
- [ ] `libs/contracts` — API types, DTOs, route definitions
- [ ] `libs/constants` — enums, shared constants
- [ ] `libs/utils` — slugify, date utils, hash utils

---

## Phase 1: Backend Core (Weeks 2-3)

### 1.1 NestJS Application
- [ ] Generate NestJS app in `apps/server`
- [ ] Configure Prisma with PostgreSQL
- [ ] Set up ValKey connection (ioredis)
- [ ] Configure environment variables (@nestjs/config)
- [ ] Set up Pino structured logging
- [ ] Set up CORS, Helmet, rate limiting

### 1.2 Database Schema (Prisma)
- [ ] User model
- [ ] Workspace model
- [ ] Note model (metadata only, content in FS)
- [ ] NoteLink model (Zettelkasten links)
- [ ] NoteVersion model
- [ ] Tag model + junction table
- [ ] Attachment model
- [ ] AuthProvider model (SAML/OIDC configs)
- [ ] Session model
- [ ] Plugin model (installed plugins)
- [ ] Create initial migration

### 1.3 Authentication Module
- [ ] Local auth (email/password + bcrypt)
- [ ] JWT access + refresh token flow
- [ ] SAML 2.0 strategy (passport-saml)
- [ ] OIDC strategy (openid-client)
- [ ] Keycloak integration testing
- [ ] Authentik integration testing
- [ ] Auth guards and decorators
- [ ] RBAC middleware

### 1.4 Notes Module
- [ ] File system service (read/write MD files)
- [ ] Note CRUD endpoints
- [ ] Note metadata sync (FS ↔ DB)
- [ ] File watcher (chokidar) for external changes
- [ ] Frontmatter parsing (yaml)
- [ ] Tag extraction and management
- [ ] Note versioning service
- [ ] Trash/restore functionality

### 1.5 Search Module
- [ ] PostgreSQL FTS setup (tsvector, GIN index)
- [ ] pg_trgm for fuzzy search
- [ ] Search API with filters (tags, folders, dates)
- [ ] Content indexing on note save

---

## Phase 2: Frontend Core (Weeks 3-5)

### 2.1 Next.js Application
- [ ] Generate Next.js 15 app in `apps/web`
- [ ] Configure Tailwind CSS 4
- [ ] Set up shadcn/ui
- [ ] Configure next-intl (English default)
- [ ] Set up Zustand stores
- [ ] Configure TanStack Query
- [ ] Auth pages (login, register, SSO redirect)
- [ ] Protected routes middleware

### 2.2 Workspace Shell (Obsidian-like UI)
- [ ] Main layout: sidebar + editor area
- [ ] Left sidebar: file explorer tree
- [ ] Right sidebar: backlinks, outline, properties
- [ ] Tab bar with closable/reorderable tabs
- [ ] Split pane system (horizontal/vertical)
- [ ] Command palette (Cmd/Ctrl+P)
- [ ] Quick switcher (Cmd/Ctrl+O)
- [ ] Status bar
- [ ] Theme system (dark/light + custom)

### 2.3 Window Management (dnd-kit)
- [ ] Draggable tab system
- [ ] Drop zones for split creation
- [ ] Snap layout templates (like Windows 11)
  - [ ] 2-column (50/50, 70/30)
  - [ ] 3-column
  - [ ] Grid (2x2)
  - [ ] Custom splits
- [ ] Layout persistence in localStorage/server
- [ ] Floating windows (settings, graph)
- [ ] Maximize/minimize panels

### 2.4 Shared UI Package
- [ ] Create `packages/ui` with shadcn/ui components
- [ ] Button, Input, Dialog, Dropdown, Toast
- [ ] CommandPalette component
- [ ] TreeView component (file explorer)
- [ ] ResizablePanel component
- [ ] Tooltip, Popover, ContextMenu

---

## Phase 3: Editor & Sync (Weeks 5-7)

### 3.1 TipTap Editor Setup (`libs/editor-core`)
- [ ] Base TipTap configuration
- [ ] Markdown serializer (TipTap ↔ MD)
- [ ] Custom extensions:
  - [ ] Wiki links `[[...]]`
  - [ ] Block references `^block-id`
  - [ ] Callouts / admonitions
  - [ ] Code blocks with syntax highlighting
  - [ ] Math (KaTeX)
  - [ ] Task lists with nesting
  - [ ] Tables (advanced)
  - [ ] Image with resize
  - [ ] Embeds (YouTube, tweets)
  - [ ] Horizontal rule
  - [ ] Footnotes
- [ ] Slash command menu (`/`)
- [ ] Toolbar (floating + fixed)
- [ ] Keyboard shortcuts
- [ ] Drag handle for blocks

### 3.2 Real-Time Sync (`libs/sync-engine`)
- [ ] Yjs document management
- [ ] y-websocket client provider
- [ ] y-indexeddb for offline persistence
- [ ] Server-side Yjs provider (NestJS WebSocket gateway)
- [ ] Document ↔ Markdown serialization
- [ ] Debounced filesystem persistence (server-side)
- [ ] Awareness protocol (cursors, presence)
- [ ] Conflict resolution strategy
- [ ] Reconnection handling

### 3.3 Collaborative Editing
- [ ] Multi-cursor display with user colors
- [ ] Presence indicators (who's viewing)
- [ ] Selection awareness
- [ ] User avatar on cursor

### 3.4 Markdown Processing (`libs/markdown`)
- [ ] unified/remark pipeline
- [ ] Wiki link parser + resolver
- [ ] Embed parser
- [ ] Frontmatter extraction
- [ ] Link extraction for graph
- [ ] MD → HTML rendering (for public view)
- [ ] HTML → MD conversion (paste handling)

---

## Phase 4: Zettelkasten & Graph (Weeks 7-8)

### 4.1 Link System
- [ ] Wiki link `[[...]]` autocomplete in editor
- [ ] Note title search for linking
- [ ] Link preview on hover
- [ ] Automatic link updating on note rename
- [ ] Broken link detection

### 4.2 Backlinks (`packages/plugin-backlinks`)
- [ ] Backlinks panel in right sidebar
- [ ] Context around each backlink
- [ ] Unlinked mentions detection
- [ ] Quick link creation from unlinked mentions
- [ ] Backlink count badges

### 4.3 Knowledge Graph (`packages/plugin-graph`)
- [ ] Force-directed graph (d3-force)
- [ ] Nodes = notes, edges = links
- [ ] Node sizing by connection count
- [ ] Color coding by folder/tag
- [ ] Interactive: click navigate, hover preview
- [ ] Filters: tag, folder, date, orphan notes
- [ ] Local graph (current note's neighbors)
- [ ] Full graph (entire vault)
- [ ] WebGL rendering for large vaults (>1000 nodes)
- [ ] Search within graph

---

## Phase 5: Plugin System (Weeks 8-10)

### 5.1 Plugin SDK (`libs/plugin-sdk`)
- [ ] Plugin context API
- [ ] Editor extension registration
- [ ] View registration
- [ ] Command registration
- [ ] Settings schema
- [ ] Storage API
- [ ] Event system
- [ ] TypeScript types for SDK

### 5.2 Plugin Loader
- [ ] Manifest parser
- [ ] Plugin download from GitHub releases
- [ ] iframe sandbox with CSP
- [ ] postMessage bridge
- [ ] Plugin lifecycle management (load/unload/reload)
- [ ] Hot-reload in development

### 5.3 Plugin Registry & Discovery
- [ ] Server-side plugin catalog API
- [ ] GitHub repository scanning (by tag)
- [ ] Plugin search with tags
- [ ] Version management
- [ ] Plugin settings storage per user
- [ ] Plugin enable/disable per workspace

### 5.4 Built-in Plugins
- [ ] Excalidraw whiteboard
- [ ] Kanban boards
- [ ] Calendar view
- [ ] Advanced databases (Notion-like)
- [ ] Slides/presentation mode
- [ ] AI assistant
- [ ] Note templates
- [ ] Daily/periodic notes
- [ ] PDF/DOCX export

---

## Phase 6: Publishing & Public Access (Weeks 10-11)

### 6.1 Publishing Engine
- [ ] "Publish" toggle per note
- [ ] Public vault configuration
- [ ] Custom domain support
- [ ] Theme selection for public view
- [ ] Navigation generation from folder structure
- [ ] SEO optimization (meta tags, sitemap, OpenGraph)

### 6.2 Public Viewer
- [ ] SSR/SSG rendering of published notes
- [ ] Read-only markdown view
- [ ] Table of contents
- [ ] Breadcrumb navigation
- [ ] Search within published vault
- [ ] Link to source (if enabled)
- [ ] Custom CSS support

---

## Phase 7: Advanced Features (Weeks 11-13)

### 7.1 Excalidraw Plugin (`packages/plugin-excalidraw`)
- [ ] Embed Excalidraw component in editor
- [ ] Save drawings as `.excalidraw` files
- [ ] Real-time collaborative drawing
- [ ] Export to PNG/SVG
- [ ] Standalone whiteboard view

### 7.2 Kanban Plugin (`packages/plugin-kanban`)
- [ ] Kanban view from note frontmatter
- [ ] Drag-and-drop cards between columns
- [ ] Card ↔ note linking
- [ ] Custom columns and statuses
- [ ] Filter and sort cards

### 7.3 Calendar Plugin (`packages/plugin-calendar`)
- [ ] Month/week/day views
- [ ] Daily notes integration
- [ ] Note date picker
- [ ] Timeline view
- [ ] Recurring notes

### 7.4 Database Plugin (`packages/plugin-database`)
- [ ] Table view (Notion-like)
- [ ] Column types: text, number, date, select, multi-select, relation, formula
- [ ] Sort, filter, group
- [ ] Multiple views per database (table, board, gallery, list)
- [ ] Row ↔ note linking
- [ ] CSV import/export

### 7.5 Additional Plugins
- [ ] Slides plugin — Markdown → presentation
- [ ] AI plugin — LLM integration for writing/summarization
- [ ] Templates plugin — note templates with variables
- [ ] PDF export plugin — note → PDF/DOCX

---

## Phase 8: Polish & DevOps (Weeks 13-14)

### 8.1 Performance
- [ ] Virtual scrolling for long notes
- [ ] Lazy loading for attachments
- [ ] Image optimization
- [ ] Bundle analysis and code splitting
- [ ] Search result caching (ValKey)
- [ ] WebSocket connection pooling

### 8.2 Docker
- [ ] Multi-stage Dockerfile for web (Next.js standalone)
- [ ] Multi-stage Dockerfile for server (NestJS)
- [ ] Docker Compose production config
- [ ] Health checks
- [ ] Volume mounts for notes storage
- [ ] Environment variable documentation

### 8.3 GitHub Actions
- [ ] CI: lint → test → build → type-check
- [ ] Release: Docker build + push to ghcr.io
- [ ] Deploy: SSH/webhook deploy to staging
- [ ] NX affected: only build/test changed packages
- [ ] Dependency caching (pnpm store)

### 8.4 Documentation
- [ ] README with setup instructions
- [ ] Plugin development guide
- [ ] API documentation (Swagger)
- [ ] Self-hosting guide
- [ ] Environment variables reference

---

## Feature Backlog (Post-MVP)

### From Competitor Research
- [ ] End-to-end encryption (optional, per-workspace)
- [ ] Note history diff viewer
- [ ] Outline/table of contents sidebar
- [ ] Focus mode (distraction-free writing)
- [ ] Word count goals
- [ ] Note favorites / bookmarks
- [ ] Workspace-level search and replace
- [ ] Import from Obsidian, Notion, Roam, Logseq
- [ ] Export to multiple formats
- [ ] Mobile-responsive editor
- [ ] Progressive Web App (PWA)
- [ ] Voice notes with transcription
- [ ] OCR for image-to-text
- [ ] Spaced repetition (flashcards from notes)
- [ ] Web clipper browser extension
- [ ] Mermaid diagram support
- [ ] PlantUML support
- [ ] Git integration (version control via git)
- [ ] Webhook integrations (Zapier, n8n)
- [ ] Audit log for enterprise
- [ ] Multi-workspace support

### Electron Desktop (Deferred)
- [ ] Electron shell with Next.js renderer
- [ ] Local filesystem note storage
- [ ] Offline-first with Yjs persistence
- [ ] System tray integration
- [ ] Global hotkey for quick capture
- [ ] File system integration (drag files)
- [ ] Auto-update mechanism
- [ ] Background sync with server
