# Notesaner — Tech Stack

## Core Dependencies

### Frontend (apps/web)

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| Framework | `next` | 15.x | App Router, SSR/SSG, API routes |
| React | `react` | 19.x | UI rendering |
| Editor | `@tiptap/react` | 2.x | Rich text editor |
| Editor | `@tiptap/pm` | 2.x | ProseMirror integration |
| Editor | `@tiptap/extension-collaboration` | 2.x | Yjs CRDT integration |
| Editor | `@tiptap/extension-collaboration-cursor` | 2.x | Multi-cursor support |
| CRDT | `yjs` | 13.x | Conflict-free replicated data types |
| CRDT | `y-websocket` | 2.x | WebSocket provider for Yjs |
| CRDT | `y-indexeddb` | 9.x | Offline persistence |
| UI | `@radix-ui/*` | latest | Accessible primitives |
| UI | `tailwindcss` | 4.x | Utility-first CSS |
| UI | `class-variance-authority` | latest | Component variants |
| UI | `lucide-react` | latest | Icons |
| State | `zustand` | 5.x | Client state management |
| Data | `@tanstack/react-query` | 5.x | Server state, caching |
| DnD | `@dnd-kit/core` | 6.x | Drag and drop (window management) |
| Graph | `d3-force` | 3.x | Force-directed graph |
| Graph | `@react-three/fiber` | 8.x | WebGL graph rendering (optional) |
| i18n | `next-intl` | 3.x | Internationalization |
| Forms | `react-hook-form` | 7.x | Form management |
| Validation | `zod` | 3.x | Schema validation (shared with backend) |
| Auth | `next-auth` | 5.x | Client-side auth |
| Markdown | `unified` | 11.x | Markdown processing pipeline |
| Markdown | `remark-*` | latest | Markdown plugins |
| Markdown | `rehype-*` | latest | HTML processing |

### Backend (apps/server)

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| Framework | `@nestjs/core` | 11.x | Application framework |
| Framework | `@nestjs/platform-express` | 11.x | HTTP server |
| WebSocket | `@nestjs/websockets` | 11.x | WebSocket gateway |
| WebSocket | `ws` | 8.x | WebSocket implementation |
| ORM | `prisma` | 6.x | Database toolkit |
| ORM | `@prisma/client` | 6.x | Type-safe DB client |
| Auth | `@nestjs/passport` | 11.x | Auth strategies |
| Auth | `passport-saml` | 4.x | SAML 2.0 |
| Auth | `openid-client` | 6.x | OIDC (Keycloak, Authentik) |
| Auth | `@nestjs/jwt` | 11.x | JWT tokens |
| Cache | `@nestjs/cache-manager` | 3.x | Caching abstraction |
| Cache | `ioredis` | 5.x | ValKey/Redis client |
| Queue | `@nestjs/bullmq` | 11.x | Job queues |
| Queue | `bullmq` | 5.x | Queue implementation |
| CRDT | `yjs` | 13.x | Server-side CRDT |
| CRDT | `y-websocket` | 2.x | Server WebSocket provider |
| Validation | `class-validator` | 0.14.x | DTO validation |
| Validation | `class-transformer` | 0.5.x | DTO transformation |
| Validation | `zod` | 3.x | Shared schema validation |
| Config | `@nestjs/config` | 4.x | Environment config |
| Logging | `nestjs-pino` | 4.x | Structured logging |
| File | `chokidar` | 4.x | File system watcher |
| Search | `pg_trgm` | (PostgreSQL extension) | Fuzzy text search |
| Rate Limit | `@nestjs/throttler` | 6.x | Rate limiting |

### Shared Libraries (libs/)

| Library | Purpose | Key Exports |
|---------|---------|-------------|
| `@notesaner/contracts` | API types, DTOs | `NoteDto`, `UserDto`, `PluginManifest`, API routes |
| `@notesaner/constants` | Enums, constants | `NoteStatus`, `UserRole`, `PluginType` |
| `@notesaner/utils` | Shared utilities | `slugify`, `parseWikiLink`, `debounce` |
| `@notesaner/editor-core` | TipTap config | Editor extensions, custom nodes, marks |
| `@notesaner/sync-engine` | Yjs sync logic | `SyncProvider`, `OfflineStore`, `ConflictResolver` |
| `@notesaner/markdown` | MD processing | `parseMarkdown`, `renderToHtml`, `extractLinks` |
| `@notesaner/plugin-sdk` | Plugin API | `PluginContext`, `registerPlugin`, `usePluginAPI` |

### DevOps

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 28.x | Containerization |
| Docker Compose | 2.x | Local dev environment |
| GitHub Actions | - | CI/CD pipelines |
| NX | 22.x | Monorepo build system |
| Vitest | 3.x | Unit/integration testing |
| Playwright | 1.x | E2E testing |
| ESLint | 9.x | Linting (flat config) |
| Prettier | 3.x | Formatting |
| Husky | 9.x | Git hooks |
| Commitlint | 19.x | Conventional commits |

## Environment Requirements

- Node.js >= 22.x
- pnpm >= 10.x
- PostgreSQL >= 16
- ValKey >= 8.0 (or Redis >= 7.0)
- Docker >= 24.x (for deployment)
