# Notesaner — Comprehensive Development Plan
# Wave 01 | Agile Master Artifact | 2026-03-25

---

## Executive Summary

This plan covers the full product delivery of Notesaner — not an MVP, but the complete
web-first Obsidian alternative with real-time collaboration, plugin ecosystem, Zettelkasten
graph, and self-hosting. It is structured for **20 parallel developer agents** across
14 two-week sprints (28 weeks / ~7 months).

**Team composition**: 6 Backend + 8 Frontend + 4 Plugin + 2 DevOps/QA = 20 agents

**Target**: Full product ready for self-hosted release at Sprint 14 completion.

---

## Section 1: Development Phases

### Phase 0 — Foundation (Sprint 0, Weeks 1-2)

Establish the monorepo, toolchain, CI/CD, and shared contracts before any feature work
begins. Nothing from later phases can proceed without these foundations.

**Scope**:
- NX monorepo initialization with pnpm workspaces
- `libs/contracts`, `libs/constants`, `libs/utils` scaffolded
- `packages/ui` bootstrapped with shadcn/ui
- Docker Compose for local dev (PostgreSQL 17, ValKey 8)
- GitHub Actions CI pipeline (lint, typecheck, test, build)
- Dockerfiles for web and server
- ESLint 9 flat config, Prettier, Husky, Commitlint
- Design tokens delivered by design team (consumed here)
- Base Prisma schema skeleton

**Exit criteria**: `pnpm run ci` passes. All apps start locally via Docker Compose.

---

### Phase 1 — Backend Core (Sprints 1-2, Weeks 3-6)

Build all server-side foundations: auth, notes CRUD, search indexing, file system
management, and WebSocket gateway setup.

**Scope**:
- NestJS app with Prisma, ValKey, Pino logging, Helmet, CORS, rate limiting
- Full Prisma schema and first migration
- Local auth (email/password), JWT access+refresh, SAML 2.0, OIDC
- RBAC guards, Auth decorators
- Notes module: CRUD, filesystem read/write, chokidar watcher, frontmatter parsing
- Tag extraction, versioning, soft delete/trash
- Search: PostgreSQL FTS (tsvector + GIN index), pg_trgm fuzzy search
- BullMQ queues for async work (indexing, file operations)
- Workspace and user management endpoints

**Exit criteria**: All backend API endpoints return correct data. 85%+ unit test coverage
on all modules. Postman/HTTP smoke tests pass.

---

### Phase 2 — Frontend Shell (Sprints 2-3, Weeks 5-8)

Build the Obsidian-like application shell: layout, sidebar, tabs, window management,
theme system, and auth flows. Editor is a placeholder at this stage.

**Scope**:
- Next.js 15 app with Tailwind CSS 4, shadcn/ui, Zustand, TanStack Query, next-intl
- Auth pages: login, register, SSO redirect, protected route middleware
- Main layout: left sidebar + editor area + right sidebar
- File explorer tree (left sidebar)
- Tab bar: closable, reorderable, per-tab history (Back/Forward)
- Split pane system (horizontal + vertical) via dnd-kit
- Snap layout templates: 50/50, 70/30, 3-column, 2x2 grid, custom
- Drag-and-drop panel reordering with drop zone indicators
- Command palette (Cmd+P), Quick switcher (Cmd+O)
- Status bar, Ribbon (left sidebar icons)
- Right sidebar: backlinks panel stub, outline stub, properties stub
- Theme system: dark/light + CSS variable-based custom themes
- Saved workspace layouts (server-persisted)
- Core layout mockups from design team consumed here

**Exit criteria**: Shell renders. Auth flow works end-to-end. Tabs open/close/reorder.
Split panes resize and snap. Layout persists across reload.

---

### Phase 3 — Editor and Sync (Sprints 3-5, Weeks 7-12)

The most complex phase. Build the TipTap editor with all custom extensions, the Yjs CRDT
sync engine, collaborative cursors, and the markdown processing pipeline.

**Scope**:

`libs/editor-core`:
- Base TipTap config with ProseMirror integration
- Markdown serializer/deserializer (TipTap doc <-> MD string)
- Custom extensions: WikiLinks `[[...]]`, Block references `^block-id`, Callouts,
  Code blocks with syntax highlighting (Shiki, 50+ languages), KaTeX math,
  Task lists with nesting, Advanced tables (cell WYSIWYG), Image with resize/alignment,
  Embeds (YouTube, Twitter, oEmbed), Footnotes, Horizontal rule
- Slash command menu `/`
- Floating toolbar on text selection + fixed toolbar
- Block drag handle for reordering
- Keyboard shortcuts (Obsidian-compatible)
- Live Preview mode (render markdown inline)
- Source mode (raw markdown editing)

`libs/sync-engine`:
- Yjs document management
- y-websocket client provider
- y-indexeddb offline persistence
- Server-side Yjs WebSocket gateway (NestJS)
- Yjs doc <-> Markdown file serialization (debounced, 500ms)
- Awareness protocol: multi-cursor, presence, selection highlighting
- Reconnection + conflict resolution strategy

`libs/markdown`:
- unified/remark pipeline
- WikiLink parser and resolver
- Embed parser
- Frontmatter extraction
- Link extraction for graph
- MD -> HTML rendering (for public view and editor read mode)
- HTML -> MD for paste handling

Collaborative editing UI:
- Multi-cursor display with user colors and avatars
- Presence avatars in tab bar / header
- Selection awareness highlighting
- Editor UI mockups from design team consumed here

**Exit criteria**: Two browser tabs editing the same note merge changes in real time.
Offline edits merge on reconnect. All editor extensions render correctly. Input latency
< 16ms measured in Chromium DevTools.

---

### Phase 4 — Zettelkasten and Graph (Sprints 5-6, Weeks 11-14)

Build the full Zettelkasten link system and knowledge graph visualization.

**Scope**:

Link system:
- `[[WikiLink]]` autocomplete with note title search
- Aliased links `[[Note|Display Text]]`
- Heading links `[[Note#Heading]]`
- Block references `[[Note#^block-id]]`
- Note embeds (transclusion) `![[Note]]` with live rendering
- Typed links (continuation, counterargument, example, source) — Notesaner differentiator
- Link preview on hover (popup with note content)
- Automatic link update on note rename
- Broken link detection and repair UI
- Backlinks panel: context around each backlink, unlinked mentions detection
- Backlink count badges on notes
- Bulk move/rename with link updates

`packages/plugin-graph` (Knowledge Graph):
- Force-directed graph using d3-force
- WebGL rendering path for vaults > 1000 nodes (three.js / r3f)
- Persistent/savable layout positions (server-persisted — competitor gap)
- Semantic clustering (not just force physics — competitor gap)
- Color coding: by folder, tag, or custom property
- Node sizing by connection count
- Interactive: click to navigate, hover for preview
- Local graph (current note's neighbors)
- Full graph (entire vault)
- Filters: tag, folder, date, link type, orphan notes
- Create links by drawing edges in the graph (competitor gap)
- Search within graph
- Graph view in published/public mode
- Graph plugin UI mockups from design team consumed here

**Exit criteria**: Graph renders 2000 nodes at > 30fps. Link autocomplete works across
10,000 notes in < 100ms. Broken link scanner passes on full vault import.

---

### Phase 5 — Plugin System (Sprints 6-8, Weeks 13-18)

Build the plugin infrastructure: SDK, sandbox, loader, registry, and lifecycle management.
This is required before any built-in plugins can be developed.

**Scope**:

`libs/plugin-sdk`:
- Plugin context API (typed)
- Editor extension registration hook
- View registration hook
- Command registration hook
- Settings schema + auto-generated settings UI
- Storage API (per-plugin, per-user namespaced)
- Event system (subscribe/emit)
- Full TypeScript types for SDK
- Plugin development guide

Plugin Loader:
- Manifest parser (`manifest.json`)
- Plugin download from GitHub releases
- iframe sandbox with strict CSP
- postMessage bridge (typed protocol)
- Plugin lifecycle management: install, enable, disable, uninstall, reload
- Hot-reload in development mode

Plugin Registry and Discovery:
- Server-side plugin catalog API
- GitHub repository scanning by topic tag `notesaner-plugin`
- Plugin search with tags
- Version management and compatibility checking
- Plugin settings storage per user/workspace
- Plugin enable/disable per workspace
- Admin panel plugin management UI
- Plugin UI mockups from design team consumed here (Sprint 5 delivery)

**Exit criteria**: A third-party plugin installed from a GitHub URL executes in sandbox,
registers a command visible in command palette, and stores settings per user. No DOM
access from inside the sandbox.

---

### Phase 6 — Built-in Plugins (Sprints 7-10, Weeks 15-22)

Develop all built-in plugins in parallel. Plugin SDK from Phase 5 is their foundation.

**Scope** (developed in parallel across Plugin Team):

Core plugins (shipped as built-in, can be disabled):
- `packages/plugin-backlinks` — Backlinks panel, unlinked mentions, quick link creation
- `packages/plugin-templates` — Note templates with variables (date, title, cursor), picker
- `packages/plugin-daily-notes` — Auto-create daily note, date navigation, periodic notes
- `packages/plugin-excalidraw` — Embedded interactive whiteboard, collab drawing, PNG/SVG export
- `packages/plugin-kanban` — Kanban from frontmatter, drag-and-drop cards, card<->note linking
- `packages/plugin-calendar` — Month/week/day views, daily notes integration, recurring notes
- `packages/plugin-database` — Table/Board/Gallery/List views, column types, sort/filter/group,
  row<->note linking, CSV import/export, inline database in notes
- `packages/plugin-slides` — Markdown -> presentation, `---` slide separator, speaker notes, fullscreen
- `packages/plugin-ai` — LLM writing assist, summarization, link suggestions, auto-tagging,
  semantic search enhancement
- `packages/plugin-pdf-export` — Note -> PDF, Note -> DOCX, custom styling, batch export

Additional built-in plugins:
- `packages/plugin-mermaid` — Mermaid diagram render, live preview, image export
- Focus Mode — distraction-free writing, typewriter scrolling, word count goals
- Web Clipper (browser extension scaffolding) — readability extraction, append to note

Plugin UIs: design team mockups consumed at Sprint 5 start.

**Exit criteria**: All plugins install from the registry, render correctly, and pass
their individual acceptance tests. Excalidraw collab works between two users.
Database plugin handles 1000+ rows without UI freeze.

---

### Phase 7 — Publishing (Sprints 9-10, Weeks 19-22)

Build the public publishing engine: per-note publish toggle, SSR/SSG public viewer,
custom domains, SEO, analytics, and reader comments.

**Scope**:

Publishing engine (server):
- Publish toggle per note (persisted in DB)
- Public vault configuration (slug, theme, custom domain)
- Navigation generation from folder structure
- SEO: meta tags, sitemap.xml, OpenGraph, robots.txt
- SSR/SSG rendering pipeline (Next.js ISR)
- Custom domain support (reverse proxy configuration + DNS instructions)
- Page view analytics per note (competitor gap)
- ValKey caching for public pages

Public viewer (frontend):
- Read-only markdown view with full extension support
- Table of contents (auto-generated)
- Breadcrumb navigation
- Search within published vault
- Graph view in public mode
- Custom theme selection
- Reader comments (optional per vault — competitor gap)
- Link to source (if workspace allows it)
- Public theme mockups from design team consumed at Sprint 8

**Exit criteria**: A published vault is accessible without auth. Lighthouse score >= 90.
OpenGraph tags render correctly in social media link previews. Custom domain routes to
correct vault. Analytics track page views.

---

### Phase 8 — Advanced Features (Sprints 10-12, Weeks 21-26)

Deliver the differentiating features that make Notesaner unique against all competitors.

**Scope**:

Content Freshness System (enterprise killer feature):
- Document owner assignment per note
- Automated staleness detection (configurable: 30/60/90 day thresholds)
- "Last verified" badge with reviewer name
- Notifications to owner when document goes stale
- "Needs review" queue in admin panel
- Version diff comparison since last review

Smart Import:
- Import from: Obsidian vault zip, Notion export, Logseq JSON, Evernote ENEX, Bear
- Preserve links, tags, frontmatter, attachments
- Migration wizard with progress indicator and conflict resolution
- Dry-run preview before committing import

Guided Onboarding Wizard:
- Interactive first-run tutorial (5 steps max)
- Pre-built vault templates: GTD, Zettelkasten, Research, Team Wiki
- Progressive feature disclosure
- Tooltip hints for first-time feature use

Note Activity Feed:
- Activity stream: who edited what, when
- Per-note edit history with visual diffs
- @mentions in notes trigger notifications
- Follow notes for change notifications
- Webhook events: note created, edited, published

API and Webhooks:
- Full REST API (documented in Swagger)
- Webhook delivery to external URLs
- Zapier/n8n payload format compatibility
- API key management in settings

Multi-vault support:
- Multiple workspaces per account
- Instant workspace switching
- Different auth providers per workspace
- Optional cross-workspace search

Performance optimization:
- Virtual scrolling for long notes
- Lazy loading for attachments
- Image optimization pipeline
- Bundle analysis and code splitting
- Search result caching in ValKey
- WebSocket connection pooling

**Exit criteria**: Import of a 5000-note Obsidian vault completes in < 5 minutes.
Content freshness notifications deliver to correct owners. All Swagger endpoints documented.

---

### Phase 9 — Polish, QA, and DevOps (Sprints 12-14, Weeks 25-28)

Final hardening: E2E test coverage, accessibility audit, security review, performance
benchmarks, production Docker configuration, and documentation.

**Scope**:

QA and Testing:
- Playwright E2E test suite covering all critical user flows
- Accessibility audit: WCAG 2.1 AA compliance sweep
- Screen reader testing (NVDA, VoiceOver)
- Keyboard navigation audit throughout entire application
- Performance benchmarks: LCP < 2s, input latency < 16ms, search < 200ms,
  graph 1000 nodes < 1s, WebSocket latency < 50ms
- Load testing: 100 concurrent editors on same note, 1000 WebSocket connections

Security:
- Security audit: OWASP Top 10 review
- CSP policy hardening for plugin sandbox
- File path traversal penetration test
- JWT token expiry and rotation test
- Rate limiting verification
- Dependency vulnerability scan (npm audit, Snyk)

DevOps:
- Multi-stage Dockerfiles (Next.js standalone, NestJS)
- Docker Compose production config with health checks
- Volume mounts for notes storage documented
- GitHub Actions: CI (lint->test->build->typecheck), Release (Docker build+push to ghcr.io),
  Deploy (SSH/webhook to staging/prod)
- NX affected: only build/test changed packages
- pnpm store caching

Documentation:
- README with quick-start setup instructions
- Self-hosting guide (Docker Compose + environment variables reference)
- Plugin development guide (using plugin-sdk)
- API documentation (Swagger UI at /api/docs)
- CONTRIBUTING guide

**Exit criteria**: Lighthouse >= 90. WCAG 2.1 AA. Zero critical security findings.
Docker Compose `docker compose up` brings full stack to running state in < 2 minutes.
E2E test suite passes. Release pipeline pushes to ghcr.io successfully.

---

## Section 2: Sprint Breakdown

Each sprint is 2 weeks. Sprints overlap between phases where parallel work is possible.

---

### Sprint 0 (Weeks 1-2) — "Build the Factory"

**Goal**: Runnable monorepo with CI, shared libs scaffolded, Docker Compose working,
design tokens integrated.

**Tasks by team**:

DevOps/QA (DO-1, DO-2):
- DO-1: NX workspace init, pnpm-workspace.yaml, tsconfig.base.json, path aliases
- DO-1: ESLint 9 flat config, Prettier, Husky, Commitlint
- DO-1: Git repository, .gitignore, initial commit conventions
- DO-2: Docker Compose (PostgreSQL 17 + ValKey 8) for local dev
- DO-2: Dockerfile.web skeleton, Dockerfile.server skeleton
- DO-2: GitHub Actions CI workflow: lint, typecheck, test, build
- DO-2: GitHub Container Registry setup

Backend (BE-1):
- BE-1: `libs/contracts` scaffold (NoteDto, UserDto, AuthDto, PluginManifest, API routes)
- BE-1: `libs/constants` scaffold (NoteStatus, UserRole, PluginType enums)
- BE-1: `libs/utils` scaffold (slugify, parseWikiLink, debounce, hash utils)

Frontend (FE-1):
- FE-1: `packages/ui` scaffold with shadcn/ui base (Button, Input, Dialog, Dropdown, Toast)
- FE-1: Consume design tokens from design team delivery (CSS custom properties)

**Dependencies**: None. This sprint has no external dependencies.

**Definition of Done**:
- `pnpm run ci` exits 0 on GitHub Actions
- `docker compose up` starts PostgreSQL and ValKey
- All three libs have their index.ts with at least skeleton exports
- `packages/ui` renders a Button in Storybook

---

### Sprint 1 (Weeks 3-4) — "Backend Foundations"

**Goal**: Auth, database schema, notes CRUD, and search all working behind the API.

**Tasks by team**:

Backend (BE-1 through BE-6):
- BE-1: NestJS app scaffold in `apps/server`: Prisma config, ValKey (ioredis), Pino logging,
  CORS, Helmet, rate limiting (@nestjs/throttler)
- BE-2: Prisma schema — User, Workspace, Note, NoteVersion, NoteLink, Tag, Attachment,
  AuthProvider, Session, Plugin models. Run initial migration.
- BE-3: Auth module — local email/password (bcrypt), JWT access+refresh token flow,
  auth guards, CurrentUser decorator
- BE-4: Auth module — SAML 2.0 strategy (passport-saml), OIDC strategy (openid-client),
  Keycloak integration, Authentik integration
- BE-5: Notes module — filesystem service (read/write MD files), Note CRUD endpoints,
  chokidar file watcher, frontmatter parsing (yaml), tag extraction
- BE-6: Notes module — note versioning service, soft delete/trash+restore,
  BullMQ queue setup for async note indexing

DevOps/QA:
- DO-1: Unit test scaffold (Vitest config per app and lib)
- DO-2: Prisma migration CI step, database seed script for local dev

**Dependencies**: Sprint 0 complete (`libs/contracts` types available).

**Definition of Done**:
- POST /auth/login returns JWT. POST /auth/saml initiates SAML redirect.
- CRUD /notes endpoints pass Postman smoke tests.
- File written to disk appears in DB metadata within 2 seconds (chokidar).
- 85%+ unit test coverage on auth and notes modules.

---

### Sprint 2 (Weeks 5-6) — "Search + Frontend Shell Starts"

**Goal**: Search working. Frontend app running with auth and basic shell layout.

**Tasks by team**:

Backend (BE-1 through BE-4):
- BE-1: Search module — PostgreSQL FTS (tsvector + GIN index), content indexing on save
- BE-2: Search module — pg_trgm fuzzy search, ranked relevance, filter by folder/tag/date
- BE-3: Search API endpoints with highlighted context in results, recent searches
- BE-4: Workspace and user management endpoints (RBAC, workspace CRUD, note sharing,
  guest access read-only links)

Frontend (FE-1 through FE-6):
- FE-1: Next.js 15 app scaffold in `apps/web`: Tailwind CSS 4, shadcn/ui, Zustand stores,
  TanStack Query, next-intl (English), protected route middleware
- FE-2: Auth pages — login, register, SSO redirect handler, JWT storage (httpOnly cookie)
- FE-3: Main layout component: left sidebar + center editor area + right sidebar
  (responsive, collapsible)
- FE-4: Left sidebar — file explorer tree view (folders + files, Zustand state)
- FE-5: Tab bar — closable, reorderable tabs (dnd-kit), per-tab navigation history
  (Back/Forward buttons)
- FE-6: Command palette (Cmd+P) and Quick switcher (Cmd+O) with search

DevOps/QA:
- DO-1: Playwright setup, first smoke E2E test (login -> see workspace)
- DO-2: Frontend Docker build CI step

**Dependencies**: Sprint 1 backend auth endpoints live.

**Definition of Done**:
- Search returns results with highlighted snippets in < 200ms on 10,000 notes.
- Login with local auth works end-to-end in browser.
- File explorer renders a tree of folders and files from the API.
- Tabs open and reorder via drag.
- Command palette opens and filters commands.

---

### Sprint 3 (Weeks 7-8) — "Window Management + Editor Skeleton"

**Goal**: Full window management working. Editor renders basic markdown.

**Tasks by team**:

Frontend (FE-1 through FE-8):
- FE-1: Split pane system (horizontal + vertical) — ResizablePanel component with dnd-kit
- FE-2: Snap layout templates: 50/50, 70/30, 3-column, 2x2 grid, custom ratios
- FE-3: Drop zone indicators during panel drag
- FE-4: Floating window support (settings panel, graph panel)
- FE-5: Saved workspace layouts — Zustand store + server persistence endpoint
- FE-6: Status bar component, Ribbon component
- FE-7: Right sidebar stubs: backlinks panel (empty state), outline panel (empty state),
  properties/tags panel (empty state)
- FE-8: Theme system — dark/light CSS variables, custom theme loading, system theme detection

Backend (BE-5, BE-6):
- BE-5: Layout persistence API (save/load workspace layouts per user)
- BE-6: Note sharing endpoints, guest access tokens

`libs/editor-core` (FE-1 + FE-2):
- FE-1: TipTap base configuration, editor component wrapper
- FE-2: Markdown serializer/deserializer (TipTap doc <-> MD string)
- FE-2: Basic extensions: heading, paragraph, bold, italic, code, list, blockquote

DevOps/QA:
- DO-1: E2E tests for split pane and tab drag
- DO-2: Performance baseline measurements (Lighthouse on shell)

**Dependencies**: Sprint 2 frontend shell. Design: core layout mockups delivered.

**Definition of Done**:
- Split panes create, resize, and snap. Layout persists on page reload.
- Editor opens a note and renders headings, bold, lists from markdown.
- Theme toggles between dark and light without flash.
- Workspace layout saves and restores across browser sessions.

---

### Sprint 4 (Weeks 9-10) — "Full Editor Extensions"

**Goal**: All editor extensions implemented. Slash command, toolbar, drag handle working.

**Tasks by team**:

`libs/editor-core` (FE-1 through FE-4):
- FE-1: WikiLink `[[...]]` extension (render as chip, cursor navigation)
- FE-2: Block reference `^block-id` extension
- FE-3: Callout/admonition block extension (note, warning, danger, info, tip)
- FE-4: Code block with Shiki syntax highlighting (50+ languages)

`libs/editor-core` (FE-5 through FE-8):
- FE-5: KaTeX math block extension (inline and display)
- FE-6: Task list extension with nesting and completion tracking
- FE-7: Advanced table extension (cell WYSIWYG, row/column add/remove)
- FE-8: Image embed with resize handles and alignment controls

`libs/editor-core` continued (FE-1 through FE-4, overlapping):
- FE-1: Embed extension (YouTube, Twitter, generic oEmbed iframe)
- FE-2: Footnote extension
- FE-3: Horizontal rule extension
- FE-4: Block drag handle (reorder blocks via drag)

Editor UI (FE-5 through FE-8):
- FE-5: Slash command menu `/` with all block types, searchable
- FE-6: Floating toolbar on text selection (bold, italic, link, code, heading)
- FE-7: Fixed toolbar (top bar, toggleable)
- FE-8: Keyboard shortcuts — Obsidian-compatible defaults, all extensions

Live Preview:
- FE-1: Live Preview mode (render markdown inline, toggle per block)
- FE-2: Source mode (raw markdown display, syntax coloring)

**Dependencies**: Sprint 3 TipTap base setup. Design: editor UI mockups delivered.

**Definition of Done**:
- All R1.1-R1.17 requirements pass acceptance tests.
- Input latency < 16ms measured via editor performance harness.
- Slash menu opens within 50ms. All 30+ block types insertable.
- WikiLink renders as chip with tooltip. Footnotes render correctly.

---

### Sprint 5 (Weeks 11-12) — "Sync Engine + Zettelkasten Links"

**Goal**: Real-time collaboration working. Wiki link autocomplete and link graph in DB.

**Tasks by team**:

`libs/sync-engine` + Backend (BE-1 through BE-4):
- BE-1: Yjs WebSocket gateway (NestJS) — room management, broadcast
- BE-2: Server-side Yjs provider — doc state persistence to MD file (500ms debounce)
- BE-3: Awareness protocol — cursors, presence, selection sharing
- BE-4: Reconnection handling, offline merge strategy, conflict resolution policy

`libs/sync-engine` + Frontend (FE-1 through FE-3):
- FE-1: y-websocket client provider integration in editor
- FE-2: y-indexeddb offline persistence layer
- FE-3: Multi-cursor display (user colors, avatars on cursor positions)
- FE-3: Presence indicator in tab bar header (who's viewing this note)

`libs/markdown` (FE-4 + FE-5):
- FE-4: unified/remark pipeline, WikiLink parser and resolver
- FE-5: Embed parser, frontmatter extraction, link extraction for graph building

Zettelkasten link system (FE-6 through FE-8, BE-5):
- FE-6: `[[WikiLink]]` autocomplete dropdown (search across all note titles)
- FE-7: Aliased links `[[Note|Display]]`, heading links `[[Note#Heading]]`
- FE-8: Link preview on hover — popup with note excerpt
- BE-5: NoteLink table population on note save (async via BullMQ)
- BE-6: Automatic link update on note rename endpoint
- BE-6: Broken link detection scanner endpoint

DevOps/QA:
- DO-1: Collaboration E2E test (two headless browsers on same note)
- DO-2: WebSocket load test (100 concurrent connections)

**Dependencies**: Sprint 4 editor extensions. Sprint 1 WebSocket gateway scaffold.
Design: plugin UI mockups delivered this sprint for Phase 6 teams.

**Definition of Done**:
- Two browser tabs editing same note show each other's cursors and changes in < 50ms.
- Offline edits queue locally (IndexedDB) and merge on reconnect without data loss.
- WikiLink autocomplete returns results in < 100ms across 10,000 notes.
- Link preview popup appears on hover within 200ms.
- NoteLink table correctly populated after note save.

---

### Sprint 6 (Weeks 13-14) — "Graph + Plugin SDK"

**Goal**: Knowledge graph visualizes full vault. Plugin SDK ready for built-in plugins.

**Tasks by team**:

`packages/plugin-graph` (FE-1 through FE-4):
- FE-1: Force-directed graph with d3-force. Nodes = notes, edges = NoteLinks.
- FE-2: WebGL rendering path using three.js/@react-three/fiber for vaults > 1000 nodes
- FE-3: Persistent layout positions — save node (x, y) to server per user/workspace
- FE-4: Semantic clustering (group nodes by folder, tag, or link density analysis)

`packages/plugin-graph` continued (FE-5 through FE-8):
- FE-5: Node color coding (by folder, tag, custom property). Node sizing by connection count.
- FE-6: Interactive: click to navigate, hover for note preview popup
- FE-7: Local graph (current note's neighbors, depth 1-3 configurable)
- FE-8: Filters panel: tag, folder, date, link type, orphan notes toggle
- FE-8: Create links by drawing edges in the graph (Notesaner differentiator)
- FE-8: Search within graph (filter nodes by name)

`libs/plugin-sdk` (BE-1 through BE-3, FE-1):
- BE-1: Plugin context API (typed): editor, workspace, storage, events, commands
- BE-2: Editor extension registration hook, view registration, command registration
- BE-3: Settings schema + auto-generated settings UI (JSON Schema -> React form)
- FE-1: TypeScript types for full SDK surface. Hot-reload in dev mode.

Plugin Loader (BE-4 through BE-6):
- BE-4: Manifest parser, plugin download from GitHub releases, version management
- BE-5: iframe sandbox with strict CSP headers, postMessage bridge (typed protocol)
- BE-6: Plugin lifecycle: install, enable, disable, uninstall, reload

Plugin Registry (BE-5, DO-1):
- BE-5: Server-side plugin catalog API, GitHub topic scanning (`notesaner-plugin`)
- DO-1: Plugin registry CI — automated manifest validation on PR

DevOps/QA:
- DO-2: Plugin sandbox security test (verify no DOM escape from iframe)

**Dependencies**: Sprint 5 NoteLink table, markdown pipeline. Plugin SDK needed before
Sprint 7 Plugin Team starts built-in plugins.

**Definition of Done**:
- Graph renders 2000 nodes at > 30fps in Chrome.
- Layout positions persist across page reload.
- Creating an edge in the graph creates a WikiLink in the note file.
- A sample "hello world" plugin installs from a GitHub URL, registers a command,
  and is visible in command palette.
- Plugin cannot access parent DOM or make arbitrary XHR outside its declared permissions.

---

### Sprint 7 (Weeks 15-16) — "Core Plugins: Backlinks, Templates, Daily Notes, Kanban"

**Goal**: Four core built-in plugins complete and integrated.

**Tasks by team**:

Backend (BE-1, BE-2):
- BE-1: Unlinked mentions detection endpoint (full-text scan for note titles without links)
- BE-2: Template storage API, daily notes date navigation API

`packages/plugin-backlinks` (FE-1, FE-2):
- FE-1: Backlinks panel in right sidebar — list of notes linking here with context excerpts
- FE-2: Unlinked mentions section — notes mentioning this title without a link
- FE-2: Quick "Add Link" action from unlinked mention. Backlink count badges.

`packages/plugin-templates` (FE-3, FE-4):
- FE-3: Template picker on new note creation, template storage in `_templates/` folder
- FE-4: Variable interpolation: {{date}}, {{title}}, {{cursor}}, {{weekday}}
- FE-4: Custom template triggers (e.g., `/template` slash command)

`packages/plugin-daily-notes` (FE-5, FE-6):
- FE-5: Auto-create note for today's date on calendar open or hotkey
- FE-6: Navigate by date (previous/next day buttons, date picker)
- FE-6: Weekly/monthly periodic notes, daily note template support

`packages/plugin-kanban` (FE-7, FE-8):
- FE-7: Kanban board view from note frontmatter (`kanban: true`, columns from frontmatter)
- FE-8: Drag-and-drop cards between columns (dnd-kit), card<->note linking
- FE-8: Custom columns/statuses, filter and sort cards

Plugin Team (PL-1 through PL-4):
- PL-1: `packages/plugin-backlinks` manifest, tests, SDK integration
- PL-2: `packages/plugin-templates` manifest, tests, SDK integration
- PL-3: `packages/plugin-daily-notes` manifest, tests, SDK integration
- PL-4: `packages/plugin-kanban` manifest, tests, SDK integration

DevOps/QA:
- DO-1: Plugin E2E tests: install -> configure -> use for each plugin this sprint
- DO-2: Plugin registry entries for all four plugins

**Dependencies**: Sprint 6 Plugin SDK and sandbox complete.

**Definition of Done**:
- Backlinks panel shows links with context. Unlinked mentions detectable on demand.
- Template creates note with all variables resolved.
- Daily note auto-creates with today's date in filename.
- Kanban board drag-and-drop updates frontmatter in the source note file.
- All four plugins pass E2E acceptance tests.

---

### Sprint 8 (Weeks 17-18) — "Excalidraw, Calendar, Publishing Starts"

**Goal**: Excalidraw and Calendar plugins complete. Publishing backend ready.

**Tasks by team**:

`packages/plugin-excalidraw` (FE-1, FE-2, PL-1):
- FE-1: Embed Excalidraw component in editor as a custom TipTap node
- FE-2: Collaborative drawing via Yjs (shared Yjs document for each drawing)
- PL-1: Save drawings as `.excalidraw` JSON files, export to PNG/SVG
- PL-1: Standalone whiteboard view (full-screen, openable from file explorer)

`packages/plugin-calendar` (FE-3, FE-4, PL-2):
- FE-3: Month view calendar with note markers on dates
- FE-4: Week view and day view, timeline view
- PL-2: Date picker for notes, recurring notes configuration, daily notes integration

Publishing backend (BE-1 through BE-4):
- BE-1: Publish toggle per note stored in DB, public vault configuration model
- BE-2: Navigation generation from folder structure (auto-generate sidebar tree)
- BE-3: SEO pipeline: meta tags, OpenGraph, sitemap.xml, robots.txt generation
- BE-4: ValKey caching layer for public page renders, cache invalidation on note publish

Publishing frontend (FE-5, FE-6, FE-7):
- FE-5: Publish toggle UI in note header / properties panel
- FE-6: Public vault configuration page (slug, custom domain, theme selection)
- FE-7: ISR/SSG route for public viewer — `/p/[vault-slug]/[...path]`
- FE-8: Public viewer layout: read-only markdown render, ToC, breadcrumbs

Plugin Team (PL-3, PL-4):
- PL-3: `packages/plugin-database` — Table view scaffold: column type definitions,
  add/remove rows, basic sort and filter
- PL-4: `packages/plugin-slides` — Markdown -> slides (split on `---`), fullscreen mode

DevOps/QA:
- DO-1: Excalidraw collaborative drawing E2E test
- DO-2: Publishing pipeline smoke test (publish note -> accessible at public URL)
- Design: public theme mockups consumed this sprint (FE-7, FE-8)

**Dependencies**: Sprint 6 Plugin SDK. Sprint 5 sync engine (Excalidraw collab).

**Definition of Done**:
- Excalidraw drawing embeds in note, persists to `.excalidraw` file, exports PNG.
- Two users see each other's drawing strokes in < 100ms.
- Calendar renders notes on correct dates. Recurring notes create on schedule.
- Published note accessible at `/p/vault-slug/note-slug` without authentication.
- Lighthouse >= 85 on public viewer page.

---

### Sprint 9 (Weeks 19-20) — "Database Plugin + Publishing Polish"

**Goal**: Database plugin full feature set. Publishing: custom domains, analytics, comments.

**Tasks by team**:

`packages/plugin-database` (PL-1, PL-2, FE-1, FE-2):
- PL-1: All column types: text, number, date, select, multi-select, relation, formula,
  checkbox, URL, email
- PL-2: Board view (Kanban-style from DB), Gallery view, List view
- FE-1: Group by, sort by, filter by column — full query UI
- FE-2: Row <-> note linking (row opens a note, note has a DB row), CSV import/export
- FE-2: Inline database embed in note (as TipTap node)

Publishing: custom domains and analytics (BE-1, BE-2, BE-3):
- BE-1: Custom domain support — reverse proxy config generation, CNAME instructions UI
- BE-2: Page view analytics per note (increment counter on public page load, ValKey HLL)
- BE-3: Analytics dashboard in workspace settings — views per note, trend charts

Publishing: reader comments (BE-4, FE-3, FE-4):
- BE-4: Reader comments model (anonymous or email-gated), moderation queue API
- FE-3: Comment thread UI on public view (Giscus-style or native)
- FE-4: Comment moderation panel in workspace admin

`packages/plugin-ai` (PL-3, PL-4, BE-5):
- PL-3: LLM writing assist — continue writing, rephrase, expand selection commands
- PL-4: Note summarization (sidebar panel), auto-tagging suggestions
- BE-5: LLM provider abstraction (OpenAI API, local Ollama endpoint), API key config

`packages/plugin-pdf-export` (PL-3):
- PL-3: Note -> PDF via puppeteer or pdfmake, Note -> DOCX via docx library
- PL-3: Custom CSS styling for exports, batch export (folder -> zip of PDFs)

DevOps/QA:
- DO-1: Database plugin E2E tests (all view types, all column types)
- DO-2: Publishing E2E tests (custom domain routing, analytics increment)

**Dependencies**: Sprint 8 publishing scaffold. Sprint 6 Plugin SDK.

**Definition of Done**:
- Database plugin handles 500 rows in Table view without UI freeze.
- All four view types render correctly (Table, Board, Gallery, List).
- Custom domain shows correct vault content. Analytics count pages views.
- PDF export produces correctly formatted PDF for a note with all block types.

---

### Sprint 10 (Weeks 21-22) — "Advanced Features: Import, Onboarding, Freshness"

**Goal**: Smart import, content freshness system, and onboarding wizard complete.

**Tasks by team**:

Smart Import (BE-1, BE-2, FE-1, FE-2):
- BE-1: Import pipeline for Obsidian vault zip — extract MD files, attachments, rewrite links
- BE-2: Import adapters: Notion export (CSV+MD), Logseq EDN/JSON, Evernote ENEX, Bear HTML
- FE-1: Migration wizard UI: upload -> preview -> conflict resolution -> confirm -> import
- FE-2: Dry-run mode (preview what will be created/overwritten), progress tracker

Content Freshness System (BE-3, BE-4, FE-3, FE-4):
- BE-3: Document owner assignment (nullable user FK on Note), staleness threshold config
  (30/60/90 days, per workspace)
- BE-4: BullMQ scheduled job: daily scan for stale notes, notification dispatch
- FE-3: "Last verified" badge UI in note header, "Mark as reviewed" action
- FE-4: "Needs review" queue in admin panel, version diff comparison since last review

Guided Onboarding (FE-5, FE-6):
- FE-5: First-run detection (empty vault), onboarding modal wizard (5 steps)
- FE-6: Pre-built vault templates: GTD, Zettelkasten, Research, Team Wiki
- FE-6: Progressive feature disclosure (tooltip hints on first feature use)

Note Activity Feed (BE-5, FE-7):
- BE-5: Activity log table (actor, action, note_id, timestamp), webhook delivery queue
- FE-7: Activity feed panel (in right sidebar or dedicated page)
- FE-7: Follow/unfollow notes for change notifications

API and Webhooks (BE-6, FE-8):
- BE-6: REST API keys (generate, revoke in settings), webhook endpoint management
- FE-8: API key management UI in settings, webhook config UI (URL + event selection)

DevOps/QA:
- DO-1: Import E2E test (5000-note Obsidian vault import < 5 minutes)
- DO-2: Webhook delivery E2E test (create note -> webhook fires)

**Dependencies**: Sprint 1 notes module. Sprint 5 versioning.

**Definition of Done**:
- 5000-note Obsidian vault imports with links preserved in < 5 minutes.
- Stale note notifications reach note owner (email or in-app) within scheduled window.
- Onboarding wizard completes without errors. Vault template creates correct structure.
- Activity feed shows last 50 events, refreshes in real time.

---

### Sprint 11 (Weeks 23-24) — "Multi-Vault, Performance, Additional Features"

**Goal**: Multi-vault support complete. Performance optimizations applied.

**Tasks by team**:

Multi-vault (BE-1, BE-2, FE-1, FE-2):
- BE-1: Multi-workspace model (Workspace already exists — add switching API and isolation)
- BE-2: Cross-workspace search endpoint (optional, per-user setting)
- FE-1: Workspace switcher UI in left sidebar header (avatar + workspace name dropdown)
- FE-2: Workspace creation wizard, workspace settings page

Performance (FE-3, FE-4, FE-5, FE-6):
- FE-3: Virtual scrolling for long notes (ProseMirror viewport — only render visible blocks)
- FE-4: Lazy loading for attachments and images (Intersection Observer)
- FE-5: Next.js bundle analysis, code splitting per feature (dynamic imports for plugins)
- FE-6: Image optimization pipeline (Next.js Image component, server-side resize)

Backend performance (BE-3, BE-4):
- BE-3: Search result caching in ValKey (cache by query hash, invalidate on note edit)
- BE-4: WebSocket connection pooling, memory usage audit under 1000 connections

Additional built-in plugins (PL-1 through PL-4):
- PL-1: `packages/plugin-mermaid` — render Mermaid diagrams inline, live preview, image export
- PL-2: Focus Mode plugin — hide sidebar/status/tabs, typewriter scrolling, word count goals
- PL-3: Typed links UI enhancement (visual distinction in backlinks, graph color by type)
- PL-4: Timeline view (chronological note history), "On this day" feature

DevOps/QA:
- DO-1: Bundle size regression test (alert if bundle grows > 10% per sprint)
- DO-2: Load test: 100 concurrent editors on same note, measure WS latency

**Dependencies**: Sprint 2 workspace model. Sprint 5 sync engine.

**Definition of Done**:
- Workspace switching takes < 500ms.
- Virtual scrolling handles 500-page notes without scroll jank.
- Bundle size analyzer report generated. No chunk > 250kb gzipped.
- 100 concurrent WebSocket connections: p95 latency < 50ms.
- Mermaid renders all diagram types from spec.

---

### Sprint 12 (Weeks 25-26) — "Security Hardening + E2E Test Suite"

**Goal**: Security audit complete. E2E test coverage across all critical user flows.

**Tasks by team**:

DevOps/QA (DO-1, DO-2) — PRIMARY this sprint:
- DO-1: Playwright E2E suite expansion: auth flows, note CRUD, collab, graph, publishing,
  plugin install, import, onboarding, workspace management
- DO-2: OWASP Top 10 review: SQL injection, XSS, CSRF, broken auth, security misconfiguration
- DO-1: File path traversal penetration test, rate limiting verification
- DO-2: Dependency vulnerability scan (npm audit, Snyk CI integration)
- DO-1: JWT token expiry and rotation test, refresh token rotation
- DO-2: CSP policy audit for plugin iframe sandbox — verify no DOM escape

Backend (BE-1 through BE-4):
- BE-1: Security headers hardening (Helmet config review, HSTS, X-Frame-Options)
- BE-2: Input validation audit — all DTOs validated at boundary, no raw query construction
- BE-3: File access path traversal prevention — realpath validation on all FS operations
- BE-4: Rate limiting audit — per-endpoint limits reviewed and tightened

Frontend (FE-1, FE-2):
- FE-1: XSS audit — all user-generated content sanitized before render (DOMPurify)
- FE-2: Accessibility initial sweep — keyboard navigation gaps, missing aria labels

**Dependencies**: All previous sprints. Full feature set available for E2E testing.

**Definition of Done**:
- Zero critical security findings from OWASP review.
- E2E suite covers all P0 user flows. Pass rate >= 98%.
- npm audit reports zero high/critical vulnerabilities.
- Plugin sandbox verified: no DOM escape possible via postMessage.

---

### Sprint 13 (Weeks 27-28) — "Accessibility, Documentation, Docker Production"

**Goal**: WCAG 2.1 AA compliance. Production Docker configuration. Documentation complete.

**Tasks by team**:

DevOps/QA (DO-1, DO-2):
- DO-1: Multi-stage Dockerfile for web (Next.js standalone output)
- DO-2: Multi-stage Dockerfile for server (NestJS, production build)
- DO-1: Docker Compose production config — health checks, volume mounts, restart policies
- DO-2: GitHub Actions Release pipeline: Docker build + push to ghcr.io on tag
- DO-1: GitHub Actions Deploy pipeline: SSH/webhook deploy to staging
- DO-2: NX affected cache optimization: only build/test changed packages
- DO-2: pnpm store caching in CI (reduces CI time)

Frontend (FE-1 through FE-4):
- FE-1: Accessibility audit pass 1 — WCAG 2.1 AA (axe-core automated scan)
- FE-2: Keyboard navigation fixes — all interactive elements reachable via Tab
- FE-3: Screen reader testing (NVDA + Chrome, VoiceOver + Safari) — announce dynamic content
- FE-4: Focus indicators — visible focus ring on all focusable elements
- FE-4: Color contrast audit — all text/background combinations >= 4.5:1 ratio

Backend (BE-1, BE-2):
- BE-1: Swagger API documentation — all endpoints documented with examples
- BE-2: Environment variables reference documentation

Documentation (FE-5, FE-6, BE-3, BE-4):
- FE-5: README — quick-start setup instructions (< 10 commands to running)
- FE-6: Plugin development guide (using plugin-sdk, example plugin walkthrough)
- BE-3: Self-hosting guide (Docker Compose, nginx reverse proxy, SSL, custom domain)
- BE-4: CONTRIBUTING guide, architecture decision records (ADR) for key decisions

**Dependencies**: Sprint 12 security hardening complete.

**Definition of Done**:
- `docker compose up` brings full stack running in < 2 minutes from cold start.
- axe-core scan: zero critical accessibility violations.
- Keyboard-only navigation works across all features (tested by DO-1).
- All docs reviewed and accurate against implemented code.
- ghcr.io push succeeds for `web:latest` and `server:latest` images.

---

### Sprint 14 (Weeks 29-30) — "Final Polish, Benchmarks, Release"

**Goal**: Performance benchmarks met. Final bug bash. Release candidate tagged.

**Tasks by team**:

DevOps/QA (DO-1, DO-2) — PRIMARY this sprint:
- DO-1: Full Lighthouse audit (all pages >= 90)
- DO-2: Performance benchmark suite: LCP, input latency, search response, graph render,
  WebSocket latency — automated in CI
- DO-1: Load test: 1000 WebSocket connections, 100 concurrent editors on one note
- DO-2: Final E2E full suite run on production Docker stack
- DO-1: Bug bash: triage and close all P0/P1 issues
- DO-2: Release candidate tagging, changelog generation

Frontend (FE-1, FE-2):
- FE-1: Performance fixes based on Lighthouse audit results
- FE-2: Final UI polish pass — spacing, animation smoothness, loading states

Backend (BE-1, BE-2):
- BE-1: Final performance tuning — query plan analysis on slow endpoints
- BE-2: Production environment variable validation on startup (fail-fast)

**Dependencies**: Sprint 13 production Docker and documentation.

**Definition of Done**:
- Lighthouse >= 90 on: login page, workspace, note editor, public viewer.
- Input latency < 16ms. Search < 200ms. Graph 1000 nodes < 1s. WS < 50ms.
- Zero P0 open bugs. P1 count tracked and resolved or deferred with justification.
- `v1.0.0-rc1` tag created and Docker images pushed to ghcr.io.
- Self-hosting works from README instructions on a clean Ubuntu 24.04 server.

---

## Section 3: Parallelization Strategy

### Team Assignments

```
BACKEND TEAM (6 agents: BE-1 through BE-6)
├── BE-1  Auth domain lead     — Auth module, JWT, SAML, OIDC, Guards
├── BE-2  Data domain lead     — Prisma schema, migrations, DB queries
├── BE-3  Search specialist    — FTS, fuzzy search, indexing, caching
├── BE-4  Sync/WS specialist   — Yjs gateway, WebSocket, awareness
├── BE-5  Notes/Files lead     — Notes CRUD, FS service, versioning, links
└── BE-6  Platform specialist  — Workspaces, users, plugins API, queues

FRONTEND TEAM (8 agents: FE-1 through FE-8)
├── FE-1  Shell lead           — Layout, split panes, window management
├── FE-2  Auth/Settings        — Auth pages, settings pages, profile
├── FE-3  Sidebar specialist   — File explorer, search UI, right sidebar panels
├── FE-4  Tabs/Navigation      — Tab bar, history, command palette, switcher
├── FE-5  Editor lead          — TipTap core, extensions group A (wikilinks, code, math)
├── FE-6  Editor specialist    — TipTap extensions group B (tables, images, slash, toolbar)
├── FE-7  Graph specialist     — d3-force graph, WebGL path, graph interactions
└── FE-8  Themes/i18n          — Theme system, CSS variables, next-intl, a11y

PLUGIN TEAM (4 agents: PL-1 through PL-4)
├── PL-1  Excalidraw + Backlinks — whiteboard plugin, backlinks panel
├── PL-2  Calendar + Database    — calendar plugin, database views
├── PL-3  AI + PDF Export        — LLM integration, export pipeline
└── PL-4  Kanban + Slides        — kanban plugin, slides plugin

DEVOPS/QA TEAM (2 agents: DO-1 through DO-2)
├── DO-1  QA/Testing            — Playwright E2E, accessibility, performance benchmarks
└── DO-2  DevOps/CI             — Docker, GitHub Actions, registry, deployment
```

### Parallel Work Windows

The following groups of tasks can run simultaneously with no ordering dependency:

**Sprint 0 — all four tracks independent**:
- Backend: shared libs scaffolding
- Frontend: UI package bootstrapping
- DevOps: CI/CD and Docker setup
- (Design: token delivery — external track)

**Sprints 1-2 — backend and frontend independent**:
- Backend builds API in full isolation
- Frontend builds shell with mock data / stub APIs
- Integration occurs at Sprint 2 end (auth flow end-to-end)

**Sprints 3-4 — editor and shell independent**:
- Shell team (FE-1 through FE-4): window management, split panes
- Editor team (FE-5 through FE-8): TipTap extensions
- Backend team: search module, workspace APIs
- No integration required until Sprint 5

**Sprints 5-6 — sync and graph independent**:
- Sync team (BE-1 through BE-4, FE-1 through FE-3): Yjs integration
- Graph team (FE-7): graph visualization
- Plugin SDK (BE-1 through BE-3): built independently of sync
- Plugin loader (BE-4 through BE-6): built in parallel with SDK

**Sprints 7-9 — all four plugins run in parallel**:
- PL-1: Excalidraw + Backlinks
- PL-2: Calendar + Database
- PL-3: AI + PDF Export
- PL-4: Kanban + Slides
- Frontend team: Publishing viewer
- Backend team: Publishing engine + custom domains

**Sprints 10-11 — advanced features all independent**:
- Import pipeline (BE-1, BE-2, FE-1, FE-2)
- Content Freshness (BE-3, BE-4, FE-3, FE-4)
- Onboarding (FE-5, FE-6)
- Activity Feed + Webhooks (BE-5, BE-6, FE-7, FE-8)
- Additional plugins (PL-1 through PL-4)

**Sprints 12-14 — QA + polish all independent**:
- DO-1: E2E tests
- DO-2: Docker production, CI pipelines
- FE teams: Accessibility, performance
- BE teams: Security hardening

---

## Section 4: Dependency Graph

### Critical Path (longest chain, must be sequential)

```
Sprint 0: libs/contracts + monorepo setup
    |
    v
Sprint 1: NestJS app + Prisma schema + Auth module + Notes CRUD
    |
    v
Sprint 2: Search module (depends on Note model)
    |
    v
Sprint 3: TipTap base editor (depends on libs/contracts note types)
    |
    v
Sprint 4: Full editor extensions (depends on Sprint 3 TipTap base)
    |
    v
Sprint 5: Yjs sync engine (depends on Sprint 4 editor + Sprint 1 WS gateway)
          + WikiLink system (depends on Sprint 2 search + Sprint 4 editor)
    |
    v
Sprint 6: Plugin SDK (depends on Sprint 5 contracts stabilized)
          + Knowledge Graph (depends on Sprint 5 NoteLink table)
    |
    v
Sprints 7-9: All built-in plugins (depends on Sprint 6 Plugin SDK)
    |
    v
Sprints 10-11: Advanced features (depends on Sprints 1-9 note/sync/plugin foundation)
    |
    v
Sprints 12-14: QA, hardening, release (depends on all features complete)
```

**Critical path duration**: 28 weeks (14 sprints), no compression possible without
reducing scope on the sequential chain.

### Blocking Dependencies (task B cannot start until task A is done)

| Blocked task | Blocked by | Reason |
|---|---|---|
| Any frontend API call | Sprint 1 auth + notes endpoints | No data without backend |
| TipTap WikiLink extension | Sprint 5 NoteLink API | Autocomplete needs note list endpoint |
| Yjs gateway (server) | Sprint 1 NestJS app + WS module | Gateway runs inside NestJS |
| Built-in plugins (all) | Sprint 6 Plugin SDK + Sandbox | SDK is the contract |
| Excalidraw collab | Sprint 5 Yjs sync engine | Collab drawing uses Yjs |
| Graph edge creation -> note link | Sprint 5 NoteLink write API | Graph calls the API |
| Publishing ISR | Sprint 1 notes read endpoint | SSG fetches note content |
| Custom domain routing | Sprint 8 public vault config | Domain maps to vault slug |
| Content Freshness notifications | Sprint 1 user model + BullMQ | Needs user email, queue |
| Import from Obsidian | Sprint 5 NoteLink writer | Must rewrite `[[links]]` on import |
| Cross-workspace search | Sprint 2 search module | Extended query across workspaces |
| Plugin analytics (AI) | Sprint 6 Plugin Registry | AI plugin installed via registry |

### Tasks That Have No Blocking Dependencies (run anytime after Sprint 0)

- `packages/ui` component expansion (any sprint)
- Theme system development (FE-8, Sprint 2+)
- i18n string extraction (FE-8, any sprint)
- Documentation writing (any sprint)
- Design mockup consumption (as delivered)
- E2E test expansion (DO-1, Sprint 2+)
- Accessibility auditing (DO-1, Sprint 3+)

---

## Section 5: Risk Register

### Risk 1 — Yjs CRDT complexity causes data loss
**Probability**: Medium | **Impact**: Critical
**Description**: Yjs conflict resolution may produce unexpected merges when offline edits
meet concurrent server edits on the same document.
**Mitigation**:
- Write isolated Yjs merge tests with simulated partition scenarios in Sprint 5.
- Implement automatic MD file snapshot before every Yjs merge.
- Define and document conflict resolution policy upfront (last-write-wins for specific fields).
- Integration test: two clients edit same paragraph offline, then reconnect. Verify no data loss.

### Risk 2 — Plugin sandbox escape (security)
**Probability**: Low | **Impact**: Critical
**Description**: A malicious or buggy plugin breaks out of the iframe sandbox and accesses
the parent DOM, user tokens, or file system.
**Mitigation**:
- Strict CSP on sandbox iframe: `sandbox="allow-scripts"` only, no `allow-same-origin`.
- Typed postMessage protocol — all messages validated on both sides.
- Penetration test the sandbox in Sprint 12 by attempting known iframe escape vectors.
- Plugin permissions declared in manifest and user-confirmed on install.

### Risk 3 — TipTap/ProseMirror performance degrades on large documents
**Probability**: Medium | **Impact**: High
**Description**: Notes with 500+ blocks or large tables may cause ProseMirror to drop below
16ms input latency, breaking the NFR1 requirement.
**Mitigation**:
- Implement ProseMirror viewport plugin for virtual rendering in Sprint 11.
- Set automated performance regression test: create 500-block note, measure input latency.
- Alert if latency exceeds 12ms (4ms buffer) during CI performance benchmark.

### Risk 4 — PostgreSQL FTS insufficient for semantic search
**Probability**: Low | **Impact**: Medium
**Description**: The AI plugin's semantic search enhancement requires vector embeddings,
which PostgreSQL FTS does not support natively. pgvector extension needed.
**Mitigation**:
- Add pgvector to Sprint 9 database configuration if AI plugin is prioritized.
- Design search module with pluggable backend (FTS now, vector later) from Sprint 2.
- MeiliSearch listed as optional in tech-stack — can be added without rewriting search module.

### Risk 5 — Real-time collaboration WebSocket scalability
**Probability**: Medium | **Impact**: High
**Description**: Requirement of 1000+ concurrent WebSocket connections and 100+ editors
per note may saturate a single NestJS process.
**Mitigation**:
- Use y-websocket in standalone mode with horizontal scaling and ValKey pub/sub for
  multi-process Yjs document sharing.
- Load test in Sprint 11 (1000 connections, 100 concurrent editors).
- Document horizontal scaling architecture in self-hosting guide.
- Implement connection pooling and heartbeat-based disconnection detection.

### Risk 6 — SAML/OIDC integration failures with diverse IdPs
**Probability**: Medium | **Impact**: High
**Description**: SAML 2.0 and OIDC have many implementation variations. Keycloak and
Authentik may behave differently from generic providers.
**Mitigation**:
- Test against Keycloak and Authentik specifically in Sprint 1 with Docker-based IdP instances.
- Add SAML attribute mapping configuration UI (field mapping per provider).
- Write IdP-specific integration test suites that run in CI.
- Document known IdP quirks in self-hosting guide.

### Risk 7 — Knowledge graph performance at scale
**Probability**: Medium | **Impact**: High
**Description**: D3 force simulation on 10,000+ nodes in the browser will freeze the tab.
The WebGL fallback path requires three.js expertise.
**Mitigation**:
- Implement the WebGL path in Sprint 6 alongside the d3 path (not as an afterthought).
- Set the WebGL threshold at 500 nodes (not 1000) to provide margin.
- Use Web Workers for force simulation calculations to prevent main thread blocking.
- Performance gate: graph renders 2000 nodes at > 30fps in Sprint 6 exit criteria.

### Risk 8 — Database plugin scope creep (Notion parity expectations)
**Probability**: High | **Impact**: Medium
**Description**: The Notion-like database plugin (formulas, relations, rollups) is
substantially complex. Teams may underestimate and spend too long on it.
**Mitigation**:
- Define a strict MVP column type set for Sprint 8: text, number, date, select, checkbox.
- Defer formula engine and rollup columns to Sprint 9/10 or post-release backlog.
- Timebox database plugin development to 2 sprints maximum (Sprints 8-9).
- Plugin Team lead reviews scope weekly. Escalate to agile master if slipping.

### Risk 9 — NX monorepo build times grow with scale
**Probability**: Medium | **Impact**: Low-Medium
**Description**: With 20 apps/libs/packages, NX build times may grow > 10 minutes in CI,
slowing delivery.
**Mitigation**:
- Enable NX affected from Sprint 0 (only build/test changed packages).
- Configure pnpm store caching in GitHub Actions from Sprint 0.
- Enable NX Cloud (free tier) for distributed task execution if CI exceeds 8 minutes.
- Monitor CI duration weekly; add caching layers proactively.

### Risk 10 — Design delivery delays block frontend shell
**Probability**: Medium | **Impact**: Medium
**Description**: If design mockups for core layout, editor UI, or plugin UIs are not
delivered on schedule, frontend teams block on implementation decisions.
**Mitigation**:
- Agree design delivery schedule in Sprint 0: tokens (Sprint 0), core layout (Sprint 2),
  editor UI (Sprint 3), plugin UIs (Sprint 5), public theme (Sprint 8).
- Frontend teams use placeholder UI with agreed component library defaults when design
  is late, then refine on design delivery.
- Establish design review touchpoints at start of each consuming sprint.

---

## Section 6: Quality Gates

### Gate 0 — Monorepo Ready (end of Sprint 0)
- [ ] `pnpm run ci` exits 0 (lint, typecheck, test, build all pass)
- [ ] Docker Compose starts PostgreSQL and ValKey successfully
- [ ] All lib packages have correct index.ts exports with types
- [ ] GitHub Actions CI workflow runs on every PR
- [ ] Code review: all PRs require 1 reviewer approval before merge

### Gate 1 — Backend API Ready (end of Sprint 1)
- [ ] All Phase 1 API endpoints return correct HTTP codes and response shapes
- [ ] Prisma schema migrated and seeded in local dev
- [ ] Auth: local login, SAML, OIDC all functional (tested against real IdPs)
- [ ] Unit test coverage >= 85% on auth and notes modules (Vitest)
- [ ] No `any` types in `libs/contracts` — all DTOs fully typed
- [ ] Security: no hardcoded secrets in codebase (git-secrets pre-commit hook active)

### Gate 2 — Frontend Shell Ready (end of Sprint 2)
- [ ] Auth flow end-to-end (login -> workspace) works in browser
- [ ] File explorer renders real data from API
- [ ] Tab system and command palette functional
- [ ] Performance: Lighthouse >= 75 on workspace page (baseline, not final)
- [ ] Zero TypeScript errors in `apps/web` with strict mode
- [ ] Responsive at 1280px, 1440px, 1920px viewport widths

### Gate 3 — Editor and Sync Ready (end of Sprint 5)
- [ ] All R1.1-R1.17 editor requirements pass manual acceptance tests
- [ ] Real-time collaboration: two users see each other's changes in < 50ms
- [ ] Offline: edits persist in IndexedDB, merge on reconnect without data loss
- [ ] Input latency < 16ms (measured in Chromium DevTools Performance tab)
- [ ] WikiLink autocomplete < 100ms across 10,000 notes
- [ ] Unit test coverage >= 80% on `libs/editor-core` and `libs/sync-engine`

### Gate 4 — Graph and Plugin SDK Ready (end of Sprint 6)
- [ ] Graph renders 2000 nodes at > 30fps in Chrome Canary (WebGL path)
- [ ] Persistent layout positions survive page reload
- [ ] Plugin sandbox: hello-world plugin installs, registers command, stores settings
- [ ] Plugin sandbox: no DOM escape possible (verified by penetration test)
- [ ] Plugin SDK TypeScript types fully exported and documented in JSDoc
- [ ] Graph: create link by drawing edge updates note file correctly

### Gate 5 — Plugins Complete (end of Sprint 9)
- [ ] All 10 built-in plugins pass their individual acceptance tests
- [ ] Excalidraw collaboration: two users see drawing strokes in < 100ms
- [ ] Database plugin handles 500 rows in Table view without UI freeze (< 200ms render)
- [ ] All plugins installable via the plugin registry UI
- [ ] Plugin settings persist across page reload for each plugin
- [ ] Publishing: Lighthouse >= 90 on public viewer, OpenGraph tags correct

### Gate 6 — Advanced Features Complete (end of Sprint 11)
- [ ] 5000-note Obsidian import completes < 5 minutes with links preserved
- [ ] Content freshness notifications delivered (in-app + email) within scheduled window
- [ ] 1000 WebSocket connections sustained: p95 latency < 50ms
- [ ] 100 concurrent editors on same note: no merge conflicts, all changes appear
- [ ] Bundle: no chunk > 250kb gzipped (Next.js bundle analyzer)
- [ ] Search < 200ms with ValKey cache warm (measured via k6 load test)

### Gate 7 — Security and Accessibility (end of Sprint 12)
- [ ] OWASP Top 10: zero critical findings, zero high findings
- [ ] npm audit: zero high/critical vulnerabilities
- [ ] Plugin sandbox penetration test: all known escape vectors blocked
- [ ] E2E suite: >= 98% pass rate on full Playwright suite
- [ ] axe-core automated scan: zero critical accessibility violations
- [ ] All user-generated content sanitized with DOMPurify before render

### Gate 8 — Production Ready (end of Sprint 14) — RELEASE CRITERIA
- [ ] Lighthouse >= 90 on: login, workspace, editor, public viewer
- [ ] Input latency < 16ms, search < 200ms, graph 1000 nodes < 1s, WS < 50ms
- [ ] Zero P0 open bugs
- [ ] WCAG 2.1 AA: axe-core zero critical + keyboard-only navigation verified
- [ ] `docker compose up` brings stack running in < 2 minutes from cold start
- [ ] All documentation reviewed and accurate
- [ ] v1.0.0-rc1 tag created and Docker images published to ghcr.io
- [ ] Self-hosting guide tested on clean Ubuntu 24.04 server by DO-1

---

## Section 7: Timeline (Gantt-style)

Week numbers run 1-28 (30 with buffer). Each cell = 1 week.

```
WEEK:       01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28
SPRINT:     [    S0    ][    S1    ][    S2    ][    S3    ][    S4    ][    S5    ][    S6    ]...

PHASE 0     [=========]
PHASE 1        [=================]
PHASE 2              [=================]
PHASE 3                    [=================================]
PHASE 4                                      [=================]
PHASE 5                                            [========================]
PHASE 6                                                        [========================...]

WEEK:       ...15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30
SPRINT:     ...[    S7    ][    S8    ][    S9    ][   S10    ][   S11    ][   S12    ][S13][S14]

PHASE 6     [=================]
PHASE 7              [=================]
PHASE 8                                [=================================]
PHASE 9                                                        [=================================]
```

### Detailed Week-by-Week Timeline

```
     Wk01 Wk02 Wk03 Wk04 Wk05 Wk06 Wk07 Wk08 Wk09 Wk10 Wk11 Wk12 Wk13 Wk14
     ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
BE   [P0:Scaffold ][P1: Auth+DB+Notes+Search           ][P2:Shell APIs][P3: TipTap BE]
FE   [P0:UI lib   ][P2: Shell layout+Auth         ][P3: Window Mgmt  ][P4:Editor Ext]
DO   [P0:CI/Docker][DO: Testing support throughout                              ...]
DES  [Tokens][Core Layout  ][                   ][Editor UI mockups]

     Wk13 Wk14 Wk15 Wk16 Wk17 Wk18 Wk19 Wk20 Wk21 Wk22 Wk23 Wk24 Wk25 Wk26
     ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
BE   [P3: Yjs Sync + WikiLinks      ][P5: Plugin SDK+Registry][P7:Publish][P8: Adv]
FE   [P3: Sync UI][P4:Graph+Links   ][P5: Plugin SDK FE][P6: Plugins][P7: Pub][P8]
PLG  [                              ][P6: All 4 plugin tracks (parallel)         ]
DO   [E2E expand ][Security tests   ][Load tests           ][Sec audit  ][Docker][QA]
DES  [Plugin UI mockups  ]          [                 ][Public Theme mockups     ]

     Wk25 Wk26 Wk27 Wk28 Wk29 Wk30
     ---- ---- ---- ---- ---- ----
ALL  [P9: Polish + QA + Security + Docs + Docker + Release    ]

KEY MILESTONES:
  Wk02: Monorepo live, CI green                            [M1]
  Wk06: Backend API usable (auth + CRUD)                   [M2]
  Wk08: Frontend shell renders with real data              [M3]
  Wk12: Editor with all extensions, no sync yet            [M4]
  Wk14: Real-time collaboration working (internal demo)    [M5]
  Wk16: Graph live, Plugin SDK ready                       [M6]
  Wk22: All built-in plugins functional                    [M7]
  Wk24: Publishing live, advanced features complete        [M8]
  Wk28: Feature freeze                                     [M9]
  Wk30: v1.0.0-rc1 release                                [M10]
```

### Parallel Workstream Summary

```
STREAM A (Backend — 6 agents):
  S0: libs   S1: Auth+DB   S2: Search   S3-4: WS Gateway   S5-6: Plugin Backend
  S7-9: Publish+Registry   S10-11: Advanced+Perf   S12-14: Security+Docs

STREAM B (Frontend Shell — FE-1 to FE-4):
  S0: UI lib   S2-3: Shell+Auth+Tabs   S3-4: Window Mgmt   S5: Sync UI
  S6-7: Plugin Registry UI   S8-10: Publishing   S11-14: Perf+A11y+Polish

STREAM C (Frontend Editor — FE-5, FE-6):
  S0: -   S2: Editor scaffold   S3-4: All extensions   S5: Sync binding
  S6: Graph UI (FE-7)   S7-11: Plugin UIs   S12-14: Polish

STREAM D (Plugin Team — 4 agents):
  S0-5: Waiting / prep / research   S6: SDK onboarding
  S7: Backlinks+Templates+DailyNotes+Kanban
  S8: Excalidraw+Calendar+DB scaffold+Slides
  S9: DB full+AI+PDF+Mermaid+FocusMode
  S10-11: Timeline+TypedLinks+Webhooks+WebClipper
  S12-14: Plugin polish, manifest updates

STREAM E (DevOps/QA — 2 agents):
  S0: CI+Docker   S1-5: Test scaffold+E2E expand   S6-9: Load tests
  S10-11: Performance benchmarks   S12: Security audit
  S13: Production Docker+Docs   S14: Final release
```

---

## Section 8: Design Integration Points

Design team operates on an independent track. Developer teams consume design deliveries
at defined integration points. Design must deliver before the consuming sprint starts.

### Design Delivery Schedule

| Deliverable | Design Delivery Deadline | Consumed In | Consuming Agents |
|---|---|---|---|
| Design tokens (colors, spacing, typography) | End of Week 1 (Sprint 0) | Sprint 0 | FE-8 (packages/ui) |
| Core layout mockups (sidebar, tabs, shell) | End of Week 4 (Sprint 1) | Sprint 2-3 | FE-1, FE-3, FE-4 |
| Auth page mockups (login, SSO) | End of Week 4 (Sprint 1) | Sprint 2 | FE-2 |
| Editor UI mockups (toolbar, slash menu, modes) | End of Week 6 (Sprint 2) | Sprint 3-4 | FE-5, FE-6 |
| Graph UI mockups (controls, filters, layout panel) | End of Week 10 (Sprint 4) | Sprint 6 | FE-7 |
| Plugin registry UI mockups | End of Week 10 (Sprint 4) | Sprint 6 | FE-1 |
| Plugin-specific UIs (Kanban, Calendar, DB) | End of Week 12 (Sprint 5) | Sprints 7-9 | PL-1 through PL-4 |
| Publishing viewer mockups (public layout) | End of Week 16 (Sprint 7) | Sprint 8 | FE-7, FE-8 |
| Public theme options (light, dark, custom) | End of Week 16 (Sprint 7) | Sprint 8-9 | FE-8 |
| Onboarding wizard mockups | End of Week 18 (Sprint 8) | Sprint 10 | FE-5, FE-6 |
| Admin panel mockups (users, plugins, freshness) | End of Week 18 (Sprint 8) | Sprint 10 | FE-2 |
| Mobile responsive mockups | End of Week 22 (Sprint 10) | Sprint 11-12 | FE-1, FE-8 |

### Design Token Integration (Sprint 0)

Design tokens are the foundation of the entire visual system. They are implemented as
CSS custom properties in `packages/ui/src/styles/tokens.css` and consumed by Tailwind
CSS 4 as `@theme` variables.

Required token categories for Sprint 0:
- Colors: primary, secondary, surface, border, text, error, warning, success (dark + light)
- Typography: font families, sizes, weights, line heights
- Spacing: 4px base grid tokens (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- Radius: xs, sm, md, lg, full
- Shadows: sm, md, lg, focus ring
- Motion: duration (fast 100ms, base 200ms, slow 400ms), easing curves

### Design Handoff Protocol

1. Design team delivers Figma file with component specs and token exports.
2. Consuming frontend agent creates a branch `feat/design-[component]`.
3. FE-8 (themes/i18n lead) reviews token accuracy before any component implementation.
4. Component implementation uses only tokens — no hardcoded hex values or pixel values
   outside the token system.
5. Component reviewed against Figma spec by design team before merge.

---

## Appendix A: Velocity Projections

Assuming 2-week sprints with 20 developers at average 8 story points per developer per sprint:

- Theoretical velocity: 160 SP per sprint
- Applied 75% efficiency factor (ramp-up, reviews, blockers): 120 SP per sprint
- Sprint 0 is lower (setup work): estimate 60 SP
- Sprints 12-14 are QA-heavy: estimate 80 SP (less feature work)

Total estimated SP across 14 sprints: ~1,540 SP

This aligns with the feature scope documented in requirements.md across all R1-R10
requirement sets plus the 15 plugin packages.

---

## Appendix B: Definition of Done (Global)

Applied to every task across all sprints:

- [ ] Code compiles with TypeScript strict mode (zero errors)
- [ ] Unit tests written for all business logic (target: 80%+ per module)
- [ ] No ESLint violations (flat config enforced)
- [ ] Code reviewed and approved by one peer agent
- [ ] Relevant Playwright E2E test written or updated
- [ ] No new `any` types introduced in `libs/contracts`
- [ ] Feature documented in Swagger if it is an API endpoint
- [ ] Accessibility: interactive elements have aria labels and keyboard focus
- [ ] No hardcoded secrets or magic strings (use `libs/constants`)
- [ ] Performance: no observable regression on Lighthouse or input latency

---

## Appendix C: Agent Spawn Order (team-lead reference)

For team-lead when executing this plan, the recommended agent spawn order per sprint:

**Sprint 0**: Spawn DO-1, DO-2, BE-1, FE-1 in parallel (no dependencies).

**Sprint 1**: Spawn BE-1 through BE-6 in parallel (all work on isolated NestJS modules).
FE-1, FE-2 can begin shell scaffold in parallel without waiting for BE.

**Sprint 2**: All 8 FE agents + 4 BE agents in parallel.

**Sprints 3-4**: All 8 FE agents + 4 BE agents continue in parallel.
No PL (Plugin Team) spawned yet — SDK not ready.

**Sprint 5**: All 8 FE agents + 4 BE agents + 2 DO agents.
Spawn PL agents for SDK onboarding and research only.

**Sprint 6**: All 20 agents active. PL agents begin plugin development.

**Sprints 7-11**: All 20 agents active simultaneously.
Maximum parallelization window. Team-lead monitors for cross-team blockers daily.

**Sprint 12**: Reduce to DO-1, DO-2 for security audit.
FE-1, FE-2 for accessibility. BE-1 through BE-4 for security fixes.
PL agents can continue polish and additional plugin work.

**Sprints 13-14**: All agents available for polishing, documentation, and release tasks.
DO agents lead the release process.
