# Notesaner Documentation Structure

> Generated: 2026-03-29
> Inspired by: Obsidian Help, Notion Help, Logseq Docs, Docusaurus conventions

---

## Architecture Decision: Two-Site Model

Following Obsidian's clean separation (help.obsidian.md + docs.obsidian.md) and Notion's pattern (notion.com/help + developers.notion.com), Notesaner documentation is split into two distinct sites:

| Site               | URL (proposed)       | Audience                                       |
| ------------------ | -------------------- | ---------------------------------------------- |
| **User Help**      | `help.notesaner.com` | End users, workspace admins                    |
| **Developer Docs** | `docs.notesaner.com` | Plugin developers, API consumers, contributors |

This prevents the confusion Logseq created by spreading developer resources across 3+ URLs. Users get a focused help center; developers get a focused API reference.

---

## Site 1: User Help (`help.notesaner.com`)

### Sidebar Navigation Structure

```
Getting Started
├── What is Notesaner?
├── Install & Set Up
├── Create Your First Note
├── Organize with Folders & Tags
├── Link Notes Together
├── Use the Graph View
├── Import from Obsidian / Notion / Logseq
├── Keyboard Shortcuts
├── Mobile App
└── Glossary

User Guide
├── Editor
│   ├── Markdown Syntax Reference
│   ├── Rich Text Formatting
│   ├── Tables
│   ├── Code Blocks
│   ├── Embeds & Attachments
│   ├── Callouts
│   └── Front Matter & Properties
├── Notes & Folders
│   ├── Create and Rename Notes
│   ├── Move and Organize Files
│   ├── Attachments & Media
│   ├── Templates
│   └── Note History & Recovery
├── Linking & Knowledge Graph
│   ├── Internal Links
│   ├── Backlinks
│   ├── Graph View
│   ├── Outgoing Links Panel
│   └── Zettelkasten Method
├── Search
│   ├── Full-Text Search
│   ├── Advanced Search Syntax
│   └── Saved Searches
├── Tags & Metadata
│   ├── Tags
│   ├── Properties (Front Matter)
│   └── Filtering by Metadata
├── Workspaces & Layout
│   ├── Panels and Tabs
│   ├── Split Views
│   ├── Sidebar Customization
│   └── Workspace Presets
├── Daily Notes & Journals
│   ├── Daily Notes Setup
│   ├── Journal Templates
│   └── Calendar View
└── Appearance & Theming
    ├── Themes
    ├── Custom CSS
    └── Light / Dark Mode

Collaboration
├── Real-Time Collaboration Overview
├── Invite Collaborators
├── Shared Workspaces
├── Comments & Mentions
├── Presence Indicators
└── Conflict Resolution (Yjs CRDT)

Plugins
├── Core Plugins Overview
├── AI Assistant
├── Backlinks Panel
├── Calendar & Daily Notes
├── Database View
├── Diagrams (Mermaid)
├── Drawing (Excalidraw)
├── Focus Mode
├── Graph View
├── Kanban Board
├── PDF Export
├── Slides / Presentations
├── Spaced Repetition (Flashcards)
├── Templates
├── Web Clipper
├── Installing Community Plugins
├── Managing & Updating Plugins
└── Plugin Settings Reference

Account & Settings
├── Account & Profile
├── Notifications
├── Security & Two-Factor Auth
├── Billing & Plans
└── Export & Data Portability

Troubleshooting
├── Login & Access Issues
├── Sync Not Working
├── Editor Performance
├── Plugin Errors
└── Contact Support & Report a Bug
```

---

### Page Descriptions

#### Getting Started

| Page                                   | Description                                                         | Inspired by                        |
| -------------------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| What is Notesaner?                     | Product overview, key features, difference from Obsidian/Notion     | Notion "New to Notion?"            |
| Install & Set Up                       | Web app, desktop app, mobile — account creation and first workspace | Obsidian Getting Started           |
| Create Your First Note                 | Hands-on: create a note, type markdown, save                        | Obsidian "Create your first note"  |
| Organize with Folders & Tags           | Folder tree, tags sidebar, drag-and-drop                            | Obsidian "Files and folders"       |
| Link Notes Together                    | `[[wikilinks]]`, autocomplete, link preview                         | Obsidian "Linking notes and files" |
| Use the Graph View                     | Graph visualization, filtering, navigating                          | Obsidian "Graph view" core plugin  |
| Import from Obsidian / Notion / Logseq | Step-by-step import guides for each competitor                      | Obsidian "Import notes"            |
| Keyboard Shortcuts                     | Full shortcut reference table, customization                        | Logseq "Keyboard shortcuts"        |
| Mobile App                             | iOS and Android — install, sync, offline                            | Obsidian "Mobile app"              |
| Glossary                               | Workspace, Note, Block, Property, Plugin, Vault-equivalent          | Obsidian + Logseq glossaries       |

#### User Guide — Editor

| Page                      | Description                                               |
| ------------------------- | --------------------------------------------------------- |
| Markdown Syntax Reference | Full markdown cheat sheet with live preview examples      |
| Rich Text Formatting      | Bold, italic, headers, lists — WYSIWYG editing via TipTap |
| Tables                    | Creating, editing, sorting tables in the editor           |
| Code Blocks               | Syntax highlighting, language selection, copy button      |
| Embeds & Attachments      | Images, PDFs, videos — drag-drop and inline display       |
| Callouts                  | Info, warning, tip, danger callout block types            |
| Front Matter & Properties | YAML front matter, property panel, custom fields          |

#### Collaboration

| Page                             | Description                                           | Inspired by                      |
| -------------------------------- | ----------------------------------------------------- | -------------------------------- |
| Real-Time Collaboration Overview | How Yjs CRDT works (user-friendly), conflict handling | Notion "Collaboration basics"    |
| Invite Collaborators             | Share links, invite by email, permission levels       | Notion "Sharing & Collaboration" |
| Shared Workspaces                | Workspace-level access, teamspaces                    | Notion "Workspace & Sidebar"     |
| Comments & Mentions              | Inline comments, @mentions, notifications             | Notion "Comments"                |
| Presence Indicators              | Live cursors, online status                           | (Notesaner-specific)             |
| Conflict Resolution (Yjs CRDT)   | What happens when two people edit simultaneously      | (Notesaner-specific)             |

#### Plugins

| Page                           | Description                                               | Inspired by                         |
| ------------------------------ | --------------------------------------------------------- | ----------------------------------- |
| Core Plugins Overview          | List of all 15 bundled plugins with one-line descriptions | Obsidian "Plugins" section          |
| AI Assistant                   | Setup, prompts, context awareness, privacy                | (Notesaner-specific)                |
| Backlinks Panel                | Showing notes that link to current note                   | Obsidian "Backlinks" plugin doc     |
| Calendar & Daily Notes         | Calendar widget, daily note templates, navigation         | Obsidian "Calendar" + "Daily notes" |
| Database View                  | Table/Board/Gallery view on note folders                  | Notion "Databases" (lightweight)    |
| Diagrams (Mermaid)             | Mermaid code blocks, flowcharts, sequence, Gantt          | (Mermaid-specific)                  |
| Drawing (Excalidraw)           | Embedded drawing canvas, export as PNG/SVG                | Obsidian Excalidraw plugin          |
| Focus Mode                     | Distraction-free writing, typewriter scrolling            | (Notesaner-specific)                |
| Graph View                     | Interactive knowledge graph, filters, clusters            | Obsidian "Graph view"               |
| Kanban Board                   | Card-based task view on tagged notes                      | (Notesaner-specific)                |
| PDF Export                     | Export single note or folder to PDF                       | (Notesaner-specific)                |
| Slides / Presentations         | Reveal.js-style presentations from markdown               | Obsidian "Slides" plugin            |
| Spaced Repetition (Flashcards) | Create, review, and schedule flashcards                   | Obsidian "Spaced repetition"        |
| Templates                      | Variable templates, template picker, hotkeys              | Obsidian "Templates" plugin         |
| Web Clipper                    | Browser extension, clip to note                           | Obsidian "Web Clipper"              |
| Installing Community Plugins   | Plugin registry, trust model, install steps               | Obsidian "Community plugins"        |
| Managing & Updating Plugins    | Enable/disable, update, uninstall                         | Obsidian "Extending Obsidian"       |

---

## Site 2: Developer Docs (`docs.notesaner.com`)

### Sidebar Navigation Structure

```
Self-Hosting Guide
├── Overview & Requirements
├── Docker Compose (Recommended)
├── Environment Variables Reference
├── Database Setup (PostgreSQL)
├── Cache Setup (ValKey / Redis)
├── File Storage Configuration
├── Reverse Proxy (Nginx / Caddy)
├── HTTPS & TLS
├── Authentication
│   ├── Built-in Auth
│   ├── SAML SSO (Keycloak, Authentik)
│   └── OIDC Setup
├── Upgrading Notesaner
├── Backup & Restore
├── Monitoring & Health Checks
└── Troubleshooting Self-Hosted Instances

Architecture Overview
├── System Architecture Diagram
├── Monorepo Structure (NX)
├── Frontend Architecture (FSD)
├── Backend Architecture (Clean Architecture)
├── Real-Time Sync (Yjs CRDT)
├── Plugin System (iframe sandbox)
├── Storage Model (MD files + PostgreSQL)
├── Authentication Flow
├── Event-Driven Architecture (CQRS)
└── Dependency Graph

API Reference
├── REST API Overview
├── Authentication (Bearer tokens, API keys)
├── Rate Limiting & Pagination
├── Endpoints
│   ├── Notes
│   ├── Folders
│   ├── Tags
│   ├── Search
│   ├── Users & Workspaces
│   ├── Plugins
│   └── Webhooks
├── WebSocket Events Reference
├── Error Codes Reference
└── Changelog (API versions)

Component Library (`packages/ui`)
├── Overview & Installation
├── Design Tokens (colors, spacing, typography)
├── Components
│   ├── Layout (Box, Flex, Grid, Stack)
│   ├── Typography (Heading, Text, Code)
│   ├── Inputs (Button, Input, Select, Checkbox)
│   ├── Overlays (Modal, Drawer, Tooltip, Popover)
│   ├── Feedback (Alert, Badge, Spinner, Toast)
│   ├── Navigation (Tabs, Breadcrumb, Sidebar)
│   └── Editor (EditorRoot, Toolbar, BubbleMenu)
├── Theming & CSS Variables
└── Contributing to the Component Library

Plugin Development Guide
├── Getting Started
│   ├── Plugin Architecture Overview
│   ├── Your First Plugin (Hello World)
│   ├── Development Environment Setup
│   └── Plugin Manifest Reference
├── Plugin SDK (`libs/plugin-sdk`)
│   ├── Plugin API Overview
│   ├── Editor API
│   ├── Storage API
│   ├── UI Components API
│   ├── Events API
│   └── Settings API
├── Guides
│   ├── Reading & Writing Notes
│   ├── Adding Toolbar Buttons
│   ├── Creating a Settings Panel
│   ├── Communicating via postMessage (iframe sandbox)
│   ├── Using External Libraries
│   └── i18n in Plugins
├── Security Model
│   ├── iframe Sandbox Restrictions
│   ├── Permission System
│   └── Plugin Review Process
├── Publishing
│   ├── Plugin Registry Overview
│   ├── Submit Your Plugin
│   ├── Versioning & Updates
│   └── Plugin Guidelines & Policies
└── Plugin API Reference (TypeScript)

Contributing
├── Contributing Overview
├── Development Setup
├── Repository Structure (NX Monorepo)
├── Coding Standards
│   ├── TypeScript Guidelines
│   ├── Frontend (FSD + React 19)
│   ├── Backend (NestJS Clean Architecture)
│   └── Testing Guidelines
├── Running Tests
│   ├── Unit Tests (Vitest)
│   └── E2E Tests (Playwright)
├── Submitting a Pull Request
├── Issue Reporting
├── Documentation Contributions
└── Code of Conduct
```

---

### Page Descriptions

#### Self-Hosting Guide

| Page                            | Description                                                    | Inspired by                                          |
| ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Overview & Requirements         | System requirements, architecture diagram, supported platforms | (No analogue has this — differentiation opportunity) |
| Docker Compose (Recommended)    | Full docker-compose.yml walkthrough, port mapping, volumes     | Standard DevOps convention                           |
| Environment Variables Reference | Complete `.env` variable table with defaults and descriptions  | Standard self-host pattern                           |
| Database Setup (PostgreSQL)     | PostgreSQL 17 setup, schema migration with Prisma              | Notesaner-specific                                   |
| Cache Setup (ValKey / Redis)    | ValKey 8 configuration, session storage, pub/sub               | Notesaner-specific                                   |
| File Storage Configuration      | Local filesystem vs S3-compatible storage for MD files         | Notesaner-specific                                   |
| Reverse Proxy (Nginx / Caddy)   | Config examples for both, WebSocket passthrough for Yjs        | Notesaner-specific                                   |
| HTTPS & TLS                     | Certbot, Let's Encrypt, self-signed cert workflows             | Standard self-host pattern                           |
| SAML SSO (Keycloak, Authentik)  | Step-by-step SAML configuration with popular providers         | Notion "SAML SSO" (enterprise admin)                 |
| OIDC Setup                      | OIDC provider configuration                                    | Notesaner-specific                                   |
| Upgrading Notesaner             | Version migration steps, Prisma migration commands             | Standard self-host pattern                           |
| Backup & Restore                | Backup MD files + Postgres dump, restore procedure             | Standard self-host pattern                           |
| Monitoring & Health Checks      | `/health` endpoint, log aggregation, alerting patterns         | Standard DevOps convention                           |

> **Note**: None of Obsidian, Notion, or Logseq document self-hosting (they are SaaS or local-first). This section is a key competitive differentiator for privacy-conscious users and enterprises.

#### Architecture Overview

| Page                                      | Description                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| System Architecture Diagram               | Full system diagram: web client → NestJS → PostgreSQL / ValKey / FS, WebSocket for Yjs |
| Monorepo Structure (NX)                   | NX workspace layout, project graph, build pipeline                                     |
| Frontend Architecture (FSD)               | Feature-Sliced Design layers: app → pages → widgets → features → entities → shared     |
| Backend Architecture (Clean Architecture) | Modules → Services → Repositories, CQRS, event bus                                     |
| Real-Time Sync (Yjs CRDT)                 | How Yjs documents are synced, WebSocket transport, 500ms debounce, persistence         |
| Plugin System (iframe sandbox)            | iframe isolation model, postMessage protocol, capability permissions                   |
| Storage Model                             | MD files as source of truth, PostgreSQL for metadata and FTS, file watcher             |
| Authentication Flow                       | JWT lifecycle, SAML flow, OIDC flow, session storage in ValKey                         |
| Event-Driven Architecture                 | CQRS pattern, event types, async event handlers                                        |
| Dependency Graph                          | NX project dependency graph, build order, affected computation                         |

#### API Reference

| Page                       | Description                                               |
| -------------------------- | --------------------------------------------------------- |
| REST API Overview          | Base URL, versioning strategy, content types, auth header |
| Authentication             | Bearer token (JWT), API key generation and usage          |
| Rate Limiting & Pagination | Rate limit headers, cursor-based pagination pattern       |
| Notes Endpoints            | CRUD for notes, search, move, history                     |
| WebSocket Events Reference | Yjs sync events, presence events, comment events          |
| Error Codes Reference      | Error code table with resolution guidance                 |

> Pattern: Obsidian and Notion both put API reference in developer docs (not help center). API reference is auto-generated from OpenAPI spec or TypeDoc where possible.

#### Plugin Development Guide

| Page                            | Description                                                   | Inspired by                         |
| ------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| Plugin Architecture Overview    | How plugins load (iframe), sandbox boundary, lifecycle hooks  | Obsidian "Anatomy of a plugin"      |
| Your First Plugin (Hello World) | Scaffold, manifest, register, test — end-to-end in 10 minutes | Obsidian "Build a plugin"           |
| Development Environment Setup   | pnpm, NX, hot reload, plugin dev server                       | Obsidian "Development workflow"     |
| Plugin Manifest Reference       | All manifest fields, versioning, permissions declaration      | Obsidian "Manifest" reference       |
| Editor API                      | Reading/writing content, cursor, selections, marks            | Obsidian "Editor/" section          |
| Storage API                     | Read/write note files, create notes, metadata API             | Obsidian `Vault.md` reference       |
| UI Components API               | Render React components into plugin panels, toolbar slots     | Obsidian "User interface/" section  |
| Events API                      | Subscribe to note changes, workspace events, plugin events    | Obsidian `Events.md`                |
| Communicating via postMessage   | iframe ↔ host communication protocol, allowed origins         | Notesaner-specific (iframe sandbox) |
| iframe Sandbox Restrictions     | What is and isn't allowed in plugin iframes, CSP policy       | Notesaner-specific                  |
| Plugin Registry                 | GitHub-based registry format, submission PR template          | Obsidian "Releasing/" section       |

#### Contributing

| Page                                | Description                                                 | Inspired by                         |
| ----------------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| Contributing Overview               | Ways to contribute: code, docs, plugins, translations       | Obsidian "Contributing to Obsidian" |
| Development Setup                   | Clone, pnpm install, NX setup, running locally              | Standard open-source convention     |
| TypeScript Guidelines               | Strict mode, Zod at boundaries, barrel exports, naming      | CLAUDE.md codified                  |
| Frontend (FSD + React 19)           | FSD layers, component patterns, Zustand vs useState rules   | CLAUDE.md + FSD spec                |
| Backend (NestJS Clean Architecture) | Module structure, service/repository split, Prisma patterns | CLAUDE.md                           |
| Running Tests                       | `pnpm nx test <project>`, Vitest, Playwright E2E setup      | NX documentation pattern            |
| Submitting a Pull Request           | Branch naming, conventional commits, PR checklist           | Standard open-source convention     |

---

## Navigation Design Principles

### Breadcrumb Structure

```
Help > User Guide > Editor > Markdown Syntax Reference
Docs > Plugin Development Guide > Plugin SDK > Editor API
```

### Sidebar Behavior

- Top-level sections are always visible (collapsed by default except active)
- Active section expands to show all pages
- Current page highlighted
- Follows Obsidian's flat 1-level nesting for user help; 2-level for developer docs

### Search

- Algolia DocSearch (Docusaurus default) for both sites
- Separate search indexes per site (help vs docs)
- Keyboard shortcut: `Cmd+K` / `Ctrl+K`

### Cross-Site Links

- Help pages that reference plugin settings link to the Plugin Development Guide
- Architecture Overview pages link to relevant Self-Hosting pages
- API Reference links to relevant help center pages for context

---

## Recurring Page Template (per major feature)

Follows Obsidian's pattern where each major feature section includes:

1. **Introduction** — what the feature is and why it exists
2. **Setup** — how to enable/configure
3. **Usage** — step-by-step tasks
4. **Settings reference** — all configurable options in a table
5. **Troubleshooting** — common issues and solutions
6. **FAQ** — short questions and answers

---

## Implementation Notes

### Tooling Recommendation

- **Docusaurus 3** for both sites (MDX support, Algolia DocSearch, versioning, i18n)
- Separate `apps/docs-help` and `apps/docs-developer` in the NX monorepo
- Plugin API reference auto-generated from TypeDoc (`libs/plugin-sdk`)
- REST API reference auto-generated from OpenAPI spec (`apps/server`)
- Both sites deployed via GitHub Actions on merge to `main`

### Versioning Strategy

- Developer docs versioned alongside app releases (match semver)
- User help not versioned (always reflects latest stable)
- API changelog page maintained manually per release

### i18n

- English default (matching `CLAUDE.md`)
- Docusaurus i18n plugin for future translations
- Plugin API reference stays English-only
