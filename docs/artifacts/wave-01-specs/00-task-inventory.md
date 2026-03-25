# Notesaner — Task Inventory
**Generated**: 2026-03-25
**Total Tasks**: 225
**Tool**: Beads (`bd`) task manager

---

## Summary by Domain

| Domain | Tasks | Priority Range |
|--------|-------|---------------|
| Domain 1: Foundation | 10 | P0–P1 |
| Domain 2: Backend Core | 46 | P0–P2 |
| Domain 3: Frontend Core | 38 | P0–P2 |
| Domain 4: Editor | 20 | P0–P2 |
| Domain 5: Sync & Collaboration | 7 | P0–P1 |
| Domain 6: Zettelkasten & Graph | 12 | P0–P2 |
| Domain 7: Plugins | 24 | P0–P2 |
| Domain 8: Publishing | 9 | P1–P3 |
| Domain 9: Advanced Features | 14 | P1–P2 |
| Domain 10: DevOps & QA | 18 | P0–P1 |
| Docs | 3 | P1 |

---

## Domain 1: Foundation (Phase 0)

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-0aq | [Foundation] Initialize NX workspace with pnpm and configure path aliases | P0 |
| notesaner-yz9 | [Foundation] Configure ESLint 9 flat config for monorepo | P0 |
| notesaner-fvt | [Foundation] Configure Prettier with project-wide format rules | P0 |
| notesaner-sxr | [Foundation] Set up Vitest for unit testing across monorepo | P0 |
| notesaner-swj | [Foundation] Configure Husky + Commitlint for git hooks | P1 |
| notesaner-8kg | [Foundation] Create libs/contracts with shared API types and DTOs | P0 |
| notesaner-tv1 | [Foundation] Create libs/constants with shared enums and constants | P0 |
| notesaner-zho | [Foundation] Create libs/utils with shared utility functions | P0 |
| notesaner-ijs | [Foundation] Docker Compose setup for local development | P0 |
| notesaner-iuj | [Foundation] GitHub Actions CI pipeline (lint, test, build) | P1 |
| notesaner-tp9 | [Foundation] GitHub Actions release pipeline (Docker build + push to ghcr.io) | P1 |

### Foundation Dependencies
- `notesaner-8kg` depends on `notesaner-0aq` (contracts requires NX workspace)
- `notesaner-tv1` depends on `notesaner-0aq`
- `notesaner-zho` depends on `notesaner-0aq`
- `notesaner-iuj` depends on `notesaner-yz9`, `notesaner-fvt`, `notesaner-sxr` (CI requires lint/format/test tooling)

---

## Domain 2: Backend Core

### 2.1 NestJS Application Setup

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-5pm | [Backend] Generate NestJS application in apps/server | P0 |
| notesaner-0su | [Backend] Configure Prisma ORM with PostgreSQL connection | P0 |
| notesaner-uc5 | [Backend] Configure ValKey (Redis) connection with ioredis | P0 |
| notesaner-93t | [Backend] Implement BullMQ job queues for background processing | P0 |
| notesaner-vyj | [Backend] Implement global error handling and logging | P0 |
| notesaner-1ts | [Backend] Implement rate limiting middleware | P0 |
| notesaner-ay8a | [Backend] Configure CORS and security headers | P0 |
| notesaner-6lmy | [Backend] Implement input validation across all endpoints | P0 |
| notesaner-l7ru | [Backend] Implement health check and readiness endpoints | P0 |
| notesaner-81ih | [Backend] Implement structured error codes for API responses | P1 |
| notesaner-3q4j | [Backend] Implement API response compression and caching headers | P1 |

### 2.2 Database Schema

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-tgf | [Backend/DB] Implement full Prisma schema with all models | P0 |
| notesaner-06d | [Backend/DB] Create initial Prisma migration | P0 |

### 2.3 Authentication Module

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-3ln | [Backend/Auth] Implement local email/password authentication | P0 |
| notesaner-2v2 | [Backend/Auth] Implement JWT access and refresh token flow | P0 |
| notesaner-wevd | [Backend/Auth] Implement secure session management with token rotation | P0 |
| notesaner-16z | [Backend/Auth] Implement SAML 2.0 authentication strategy | P0 |
| notesaner-odu | [Backend/Auth] Implement OIDC authentication strategy | P0 |
| notesaner-eco | [Backend/Auth] Implement RBAC guards and decorators | P0 |
| notesaner-wux | [Backend/Auth] Implement TOTP two-factor authentication | P1 |
| notesaner-hn7 | [Backend/Auth] Admin panel API for auth provider management | P1 |
| notesaner-fza | [Backend/Auth] Implement email verification for local auth registration | P1 |
| notesaner-5xda | [Backend/Auth] Implement password reset flow | P1 |
| notesaner-3fto | [Backend/Auth] Implement workspace invitation system | P1 |

### 2.4 Notes Module

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-lso | [Backend/Notes] Implement filesystem service for reading/writing MD files | P0 |
| notesaner-3fw | [Backend/Notes] Implement Note CRUD API endpoints | P0 |
| notesaner-86v | [Backend/Notes] Implement frontmatter parsing and tag extraction | P0 |
| notesaner-4xl | [Backend/Notes] Implement file watcher for external changes | P0 |
| notesaner-i8a | [Backend/Notes] Implement note versioning service | P0 |
| notesaner-98o | [Backend/Notes] Implement trash/restore and soft delete | P0 |
| notesaner-34t | [Backend/Notes] Implement bulk move/rename with link updates | P0 |
| notesaner-78f | [Backend/Notes] Implement NoteLink extraction and backlink indexing | P0 |
| notesaner-9pm8 | [Backend/Notes] Implement automatic link update on note rename | P0 |
| notesaner-zhsk | [Backend/Notes] Implement automatic note title extraction | P0 |
| notesaner-wmli | [Backend/Notes] Implement note tag API endpoints | P0 |
| notesaner-ubtf | [Backend/Notes] Implement note folder management API | P0 |
| notesaner-8jw | [Backend/Notes] Implement note content indexing pipeline for FTS | P0 |
| notesaner-dii | [Backend/Notes] Implement block reference system | P1 |
| notesaner-bnd | [Backend/Notes] Implement comment/annotation system API | P1 |
| notesaner-afv3 | [Backend/Notes] Implement note content hash validation | P1 |
| notesaner-6d4f | [Backend/Notes] Implement word count and reading time calculation | P1 |
| notesaner-f6pw | [Backend/Notes] Implement content freshness tracking fields | P1 |
| notesaner-xm70 | [Backend/Notes] Implement guest access (read-only share links) | P1 |
| notesaner-hjtr | [Backend/Notes] Implement note alias support | P2 |
| notesaner-tuhx | [Backend/Notes] Implement image optimization for attachments | P2 |

### 2.5 Search Module

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-aom | [Backend/Search] Implement full-text search with PostgreSQL tsvector | P0 |
| notesaner-s7d | [Backend/Search] Implement fuzzy search with pg_trgm | P0 |
| notesaner-54i | [Backend/Search] Implement search filters and recent searches | P1 |
| notesaner-0i01 | [Backend/Search] Implement semantic search with embedding vectors | P2 |

### 2.6 File Management Module

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-57r | [Backend/Files] Implement attachment upload and management | P1 |

### 2.7 Sync Module

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-9ok | [Backend/Sync] Implement Yjs WebSocket gateway (NestJS) | P0 |
| notesaner-m93 | [Backend/Sync] Implement debounced filesystem persistence from Yjs state | P0 |
| notesaner-he5j | [Backend/Sync] Implement WebSocket connection authentication | P0 |
| notesaner-b1sg | [Backend/Sync] Implement Yjs document conflict resolution strategy | P1 |

### 2.8 Users and Workspaces Module

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-btu | [Backend/Workspaces] Implement workspace CRUD API | P0 |
| notesaner-1ru | [Backend/Users] Implement user management API | P0 |
| notesaner-y6lq | [Backend/Workspaces] Implement workspace storage quota management | P2 |

### 2.9 Plugins Module

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-xmr | [Backend/Plugins] Implement plugin registry API | P0 |
| notesaner-5hgg | [Backend/Plugins] Implement GitHub release download service | P1 |
| notesaner-g69k | [Backend/Plugins] Implement plugin hot-reload for development mode | P2 |

### 2.10 Publish Module

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-6lf | [Backend/Publish] Implement publishing toggle and public vault API | P1 |

### 2.11 Shared Backend Services

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-aij | [Backend/Markdown] Create libs/markdown with remark/unified pipeline | P0 |
| notesaner-szr4 | [Backend] Implement SMTP email service | P1 |

---

## Domain 3: Frontend Core

### 3.1 Next.js Application Setup

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-seu | [Frontend] Generate Next.js 15 application in apps/web | P0 |
| notesaner-dk8 | [Frontend] Set up shadcn/ui component library | P0 |
| notesaner-uzz | [Frontend] Configure Zustand state management stores | P0 |
| notesaner-ee5 | [Frontend] Configure TanStack Query for API data fetching | P0 |
| notesaner-z8x2 | [Frontend] Create packages/ui shared component library | P0 |
| notesaner-s8q7 | [Frontend] Implement next-intl internationalization setup | P2 |
| notesaner-4xa | [Frontend] Implement PWA manifest and service worker | P2 |

### 3.2 Authentication Pages

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-97n | [Frontend/Auth] Implement login page with all auth methods | P0 |
| notesaner-t5w | [Frontend/Auth] Implement registration page and protected route middleware | P0 |
| notesaner-5hu | [Frontend/Auth] Implement SSO callback handling pages | P0 |
| notesaner-6gq4 | [Frontend/Auth] Implement session management UI | P2 |

### 3.3 Workspace Shell

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-xrk | [Frontend/Workspace] Implement main Obsidian-like workspace shell layout | P0 |
| notesaner-0wx | [Frontend/Workspace] Implement file explorer tree view sidebar | P0 |
| notesaner-ed8 | [Frontend/Workspace] Implement tab bar with closable and reorderable tabs | P0 |
| notesaner-vad | [Frontend/Workspace] Implement split pane system (horizontal and vertical) | P0 |
| notesaner-92q | [Frontend/Workspace] Implement snap layout templates (Windows 11 style) | P1 |
| notesaner-wlk | [Frontend/Workspace] Implement command palette (Cmd+P) | P0 |
| notesaner-mxe | [Frontend/Workspace] Implement quick note switcher (Cmd+O) | P0 |
| notesaner-qz2 | [Frontend/Workspace] Implement right sidebar (outline, backlinks, properties) | P0 |
| notesaner-y0o | [Frontend/Workspace] Implement theme system (dark/light/custom) | P1 |
| notesaner-43q | [Frontend/Workspace] Implement status bar with note information | P1 |
| notesaner-jek | [Frontend/Workspace] Implement ribbon with quick-action icons | P1 |
| notesaner-3ez | [Frontend/Workspace] Implement workspace layout persistence | P1 |
| notesaner-kl1 | [Frontend/Workspace] Implement per-tab navigation history (Back/Forward) | P1 |
| notesaner-cfm | [Frontend/Workspace] Implement floating/detachable windows | P2 |
| notesaner-8w8y | [Frontend/Workspace] Implement maximize/minimize panel controls | P2 |
| notesaner-qjg | [Frontend/Workspace] Implement drag-and-drop file import | P1 |
| notesaner-00gj | [Frontend/Workspace] Implement workspace member management UI | P1 |

### 3.4 Settings Pages

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-s2j | [Frontend/Settings] Implement user settings pages | P1 |
| notesaner-21gc | [Frontend] Implement keyboard shortcut configuration UI | P2 |

### 3.5 Search and Notes UI

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-cgz | [Frontend] Implement search results page with highlighting | P0 |
| notesaner-4dhk | [Frontend] Implement global search (Cmd+Shift+F) | P0 |
| notesaner-bzee | [Frontend] Implement note context menu (right-click) | P0 |
| notesaner-afc | [Frontend] Implement global notification and toast system | P1 |
| notesaner-6z2 | [Frontend] Implement note properties editor (frontmatter UI) | P1 |
| notesaner-cux | [Frontend] Implement inline comment display in editor | P1 |
| notesaner-r0x | [Frontend] Implement note version history diff viewer | P1 |
| notesaner-8ffs | [Frontend] Implement note trash bin UI | P1 |
| notesaner-s02s | [Frontend] Implement tag management UI | P1 |
| notesaner-k73m | [Frontend] Implement editor source mode (raw Markdown) | P1 |
| notesaner-1vna | [Frontend] Implement note reading mode (clean view) | P1 |
| notesaner-h6l4 | [Frontend] Implement breadcrumb navigation in editor | P1 |
| notesaner-ofrr | [Frontend] Implement presence indicators (who is viewing) | P1 |
| notesaner-s8mk | [Frontend] Implement paste handling (HTML and Markdown) | P1 |
| notesaner-jd0r | [Frontend] Implement workspace switcher UI | P1 |
| notesaner-djq5 | [Frontend] Implement onboarding flow for first-time users | P1 |
| notesaner-2xhf | [Frontend] Implement mobile-responsive layout | P1 |
| notesaner-pqeo | [Frontend] Implement lazy loading for heavy features (code splitting) | P1 |
| notesaner-00ks | [Frontend] Implement virtual scrolling for large file lists | P1 |
| notesaner-cfj5 | [Frontend] Implement workspace public view navigation | P1 |
| notesaner-1qj4 | [Frontend] Implement timeline view for notes | P2 |
| notesaner-nw8a | [Frontend] Implement Obsidian-compatible CSS custom properties | P2 |
| notesaner-dbga | [Frontend] Implement copy-to-clipboard utilities throughout UI | P2 |
| notesaner-nu9r | [Frontend] Implement Storybook for UI component documentation | P2 |

---

## Domain 4: Editor (libs/editor-core)

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-ncp | [Editor] Configure TipTap base editor in libs/editor-core | P0 |
| notesaner-9if | [Editor] Implement Markdown serializer (TipTap <-> Markdown) | P0 |
| notesaner-bfz | [Editor] Implement wiki link extension ([[Note Title]] syntax) | P0 |
| notesaner-b1f | [Editor] Implement wiki link autocomplete dropdown | P0 |
| notesaner-dmz | [Editor] Implement callout/admonition extension | P0 |
| notesaner-pcx | [Editor] Implement code block extension with syntax highlighting | P0 |
| notesaner-aqo | [Editor] Implement task list extension with completion tracking | P0 |
| notesaner-ydt | [Editor] Implement advanced table extension (WYSIWYG) | P0 |
| notesaner-0xd | [Editor] Implement image embed with resize and alignment | P0 |
| notesaner-lfy | [Editor] Implement slash command menu (/) | P0 |
| notesaner-6bg | [Editor] Implement floating toolbar on text selection | P0 |
| notesaner-q1g | [Editor] Implement keyboard shortcuts (Obsidian-compatible) | P0 |
| notesaner-m38 | [Editor] Implement note embed/transclusion extension (![[Note]]) | P1 |
| notesaner-01n | [Editor] Implement KaTeX math block extension | P1 |
| notesaner-6n0 | [Editor] Implement block drag handle for reordering | P1 |
| notesaner-3g0p | [Editor] Implement find and replace within editor | P1 |
| notesaner-nbgm | [Editor] Implement selection-based block reference creation | P1 |
| notesaner-g4o | [Editor] Implement footnote extension | P2 |
| notesaner-wtn | [Editor] Implement embed extension (YouTube, Twitter, oEmbed) | P2 |
| notesaner-vq6 | [Editor] Implement Mermaid diagram extension | P2 |
| notesaner-zv4x | [Editor] Implement horizontal rule extension | P2 |

---

## Domain 5: Sync & Collaboration (libs/sync-engine)

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-4ky | [Sync] Implement Yjs document management in libs/sync-engine | P0 |
| notesaner-52s | [Sync] Implement y-indexeddb offline persistence | P0 |
| notesaner-eas | [Sync] Implement awareness protocol (cursors and presence) | P0 |
| notesaner-dvw | [Sync] Implement document serialization (Yjs Y.Text <-> Markdown) | P0 |
| notesaner-0tw | [Sync] Implement WebSocket reconnection and offline mode UI | P0 |
| notesaner-b1sg | [Backend/Sync] Implement Yjs document conflict resolution strategy | P1 |

---

## Domain 6: Zettelkasten & Graph

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-1qr | [Zettelkasten] Implement link preview on hover popup | P0 |
| notesaner-4e2 | [Zettelkasten] Implement backlinks panel in right sidebar | P0 |
| notesaner-qgs | [Zettelkasten] Implement unlinked mentions detection | P1 |
| notesaner-cnz | [Zettelkasten] Implement broken link detection and repair | P1 |
| notesaner-ej1 | [Zettelkasten] Implement typed links (relates-to, contradicts, supports, etc.) | P1 |
| notesaner-ikk | [Graph] Implement knowledge graph with d3-force (packages/plugin-graph) | P0 |
| notesaner-b2f | [Graph] Implement WebGL graph rendering for large vaults (>1000 nodes) | P1 |
| notesaner-foh | [Graph] Implement persistent graph layout saving | P1 |
| notesaner-q2e | [Graph] Implement local graph view (current note neighborhood) | P1 |
| notesaner-ygy3 | [Frontend] Implement graph search and filter panel | P1 |
| notesaner-wp2 | [Graph] Implement create link by drawing edge in graph | P2 |
| notesaner-6pa | [Graph] Implement graph semantic clustering | P2 |

---

## Domain 7: Plugins

### 7.1 Plugin Infrastructure

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-sxl | [Plugins] Create Plugin SDK in libs/plugin-sdk | P0 |
| notesaner-5n0 | [Plugins] Implement plugin manifest parser and validator | P0 |
| notesaner-9wu | [Plugins] Implement plugin sandbox (iframe + postMessage bridge) | P0 |
| notesaner-1bc | [Plugins] Implement plugin loader (download, install, load lifecycle) | P0 |
| notesaner-m02 | [Plugins] Implement plugin discovery UI (browser and search) | P1 |
| notesaner-te7 | [Plugins] Implement plugin settings UI auto-generation | P1 |

### 7.2 Built-in Plugins

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-p5d | [Plugin/Backlinks] Implement backlinks plugin as standalone package | P0 |
| notesaner-kxl | [Plugin/Excalidraw] Implement Excalidraw whiteboard plugin | P1 |
| notesaner-o29 | [Plugin/Kanban] Implement Kanban board plugin | P1 |
| notesaner-4dr | [Plugin/Calendar] Implement Calendar view plugin | P1 |
| notesaner-03d | [Plugin/Database] Implement Notion-like database plugin | P1 |
| notesaner-9q9 | [Plugin/Templates] Implement note templates plugin | P1 |
| notesaner-4su | [Plugin/DailyNotes] Implement daily notes and periodic notes plugin | P1 |
| notesaner-hn9 | [Plugin/PDFExport] Implement PDF and DOCX export plugin | P1 |
| notesaner-5bj | [Plugin/FocusMode] Implement focus mode / distraction-free writing plugin | P2 |
| notesaner-rcy | [Plugin/AI] Implement AI writing assistant plugin | P2 |
| notesaner-jfb | [Plugin/Slides] Implement presentation/slides plugin | P2 |
| notesaner-8xv | [Plugin/SpacedRepetition] Implement spaced repetition flashcard plugin | P2 |
| notesaner-1h5 | [Plugin/WebClipper] Implement web clipper browser extension | P2 |

---

## Domain 8: Publishing

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-ba1 | [Publish] Implement public vault configuration and routing | P1 |
| notesaner-jbt | [Publish] Implement SSR/SSG rendering for public notes | P1 |
| notesaner-if7 | [Publish] Implement OpenGraph and SEO meta tags for published notes | P1 |
| notesaner-cfj5 | [Frontend] Implement workspace public view navigation | P1 |
| notesaner-8bf | [Publish] Implement public vault search | P2 |
| notesaner-ml7 | [Publish] Implement analytics for published notes | P2 |
| notesaner-nk1 | [Publish] Implement custom theme selection for public vault | P2 |
| notesaner-0rb | [Publish] Implement custom domain support for public vaults | P2 |
| notesaner-3bh | [Publish] Implement reader comments for public notes | P3 |

---

## Domain 9: Advanced Features

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-7qg | [Advanced] Implement content freshness system | P1 |
| notesaner-a6x | [Advanced] Implement smart import wizard (Obsidian, Notion, Logseq) | P1 |
| notesaner-tru | [Advanced] Implement guided onboarding wizard for new users | P1 |
| notesaner-86r | [Advanced] Implement instant quick capture modal | P1 |
| notesaner-4wq | [Advanced] Implement multi-workspace support | P1 |
| notesaner-jze | [Advanced] Implement note export (Markdown, PDF, HTML, DOCX) | P1 |
| notesaner-3ul | [Advanced] Implement workspace-level search and replace | P1 |
| notesaner-5wi | [Advanced] Implement note sharing and guest access | P1 |
| notesaner-yxy | [Advanced] Implement REST API and webhook system | P2 |
| notesaner-fkc | [Advanced] Implement audit log for enterprise compliance | P2 |
| notesaner-7og | [Advanced] Implement note activity feed and change notifications | P2 |
| notesaner-w7j | [Advanced] Implement note favorites and bookmarks | P2 |

---

## Domain 10: DevOps & QA

### 10.1 DevOps

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-b0u | [DevOps] Create production Docker images (multi-stage builds) | P0 |
| notesaner-6uf | [DevOps] Create Docker Compose production configuration | P1 |
| notesaner-1k3 | [DevOps] Implement GitHub Actions deploy workflow | P1 |
| notesaner-5qpq | [DevOps] Set up NX affected commands for optimized CI | P1 |
| notesaner-nuzx | [DevOps] Implement container health checks and restart policies | P1 |
| notesaner-3agu | [DevOps] Implement Nginx reverse proxy configuration | P1 |

### 10.2 QA

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-4w2z | [QA] Implement Vitest coverage reporting and thresholds | P0 |
| notesaner-s5x | [QA] Write unit tests for backend services | P0 |
| notesaner-dd8 | [QA] Write unit tests for editor extensions | P1 |
| notesaner-y94 | [QA] Write integration tests for API endpoints | P1 |
| notesaner-772 | [QA] Set up Playwright E2E test suite | P1 |
| notesaner-xvn2 | [QA] Write E2E tests for authentication flows | P1 |
| notesaner-wwv4 | [QA] Write E2E tests for note editing and collaboration | P1 |
| notesaner-jn43 | [QA] Write E2E tests for publishing workflow | P1 |
| notesaner-pvd | [QA] Implement performance benchmarking | P1 |
| notesaner-d96 | [QA] Implement security audit and penetration testing checklist | P1 |
| notesaner-gv0 | [QA] Write accessibility tests (WCAG 2.1 AA) | P1 |

### 10.3 Documentation

| Task ID | Title | Priority |
|---------|-------|----------|
| notesaner-ccx | [Docs] Write self-hosting guide and README | P1 |
| notesaner-6ly | [Docs] Write plugin development guide | P1 |
| notesaner-r1q | [Docs] Generate Swagger/OpenAPI documentation | P1 |

---

## Dependency DAG — Critical Path

The critical path for MVP follows this dependency chain:

```
notesaner-0aq (NX Workspace)
  └── notesaner-8kg (Contracts Lib)
        ├── notesaner-5pm (NestJS App)
        │     ├── notesaner-0su (Prisma Setup)
        │     ├── notesaner-uc5 (ValKey) → notesaner-93t (BullMQ)
        │     └── notesaner-tgf (DB Schema) → notesaner-06d (Migration)
        │           ├── notesaner-3ln (Local Auth) → notesaner-2v2 (JWT) → notesaner-16z/odu/eco
        │           ├── notesaner-lso (FS Service) → notesaner-3fw (Notes CRUD)
        │           │     ├── notesaner-78f (Link Indexing) → notesaner-ikk (Graph)
        │           │     ├── notesaner-9ok (WS Gateway) → notesaner-m93 (FS Persistence)
        │           │     └── notesaner-aom (FTS) → notesaner-s7d (Fuzzy Search)
        │           └── notesaner-xmr (Plugin Registry)
        ├── notesaner-ncp (TipTap Editor)
        │     ├── notesaner-9if (MD Serializer) → notesaner-dvw
        │     ├── notesaner-bfz (Wiki Links) → notesaner-b1f (Autocomplete)
        │     ├── notesaner-4ky (Yjs Engine) → notesaner-52s/eas/0tw
        │     └── [All other editor extensions]
        └── notesaner-sxl (Plugin SDK) → notesaner-5n0 → notesaner-9wu → notesaner-1bc

notesaner-seu (Next.js App)
  └── notesaner-dk8 (shadcn/ui)
        └── notesaner-xrk (Workspace Shell)
              ├── notesaner-0wx (File Explorer)
              ├── notesaner-ed8 (Tabs) → notesaner-vad (Split Panes)
              ├── notesaner-wlk (Command Palette)
              └── notesaner-97n (Login Page) → notesaner-772 (E2E Tests)
```

---

## Priority Breakdown

| Priority | Count | Description |
|----------|-------|-------------|
| P0 (Critical) | 91 | Core infrastructure and MVP features |
| P1 (High) | 99 | Important features for full product |
| P2 (Medium) | 33 | Differentiating and enhancement features |
| P3 (Low) | 2 | Nice-to-have features |

---

## Mapping to Requirements

| Requirement | Key Tasks |
|-------------|-----------|
| R1 (Note Editor) | notesaner-ncp, bfz, dmz, pcx, aqo, ydt, 0xd, lfy, 6bg, 9if, 01n, m38 |
| R2 (Zettelkasten) | notesaner-78f, bfz, b1f, 1qr, 4e2, qgs, cnz, ej1, dii |
| R3 (Knowledge Graph) | notesaner-ikk, b2f, foh, q2e, wp2, 6pa |
| R4 (Real-Time Sync) | notesaner-9ok, m93, 4ky, 52s, eas, dvw, 0tw, he5j |
| R5 (Workspace/Windows) | notesaner-xrk, 0wx, ed8, vad, 92q, wlk, mxe, qz2, 43q |
| R6 (Auth/AuthZ) | notesaner-3ln, 2v2, 16z, odu, eco, wux |
| R7 (Plugin System) | notesaner-sxl, 5n0, 9wu, 1bc, xmr, kxl, o29, 4dr, 03d |
| R8 (Publishing) | notesaner-6lf, ba1, jbt, if7, 8bf, 0rb |
| R9 (Search) | notesaner-aom, s7d, 54i, cgz, 4dhk |
| R10 (File Management) | notesaner-lso, 4xl, i8a, 98o, 34t, 57r |
| NFR1 (Performance) | notesaner-pvd, 00ks, pqeo, b2f |
| NFR2 (Scalability) | notesaner-9ok, aom, b2f |
| NFR3 (Security) | notesaner-eco, 1ts, ay8a, 6lmy, wevd, d96 |
| NFR4 (Accessibility) | notesaner-gv0 |
| NFR5 (i18n) | notesaner-s8q7 |
