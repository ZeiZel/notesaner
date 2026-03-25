# Notesaner — Requirements Specification

## Product Vision

**"Obsidian's power without the setup, with collaboration from day one."**

A web-first, self-hostable knowledge management platform that combines:
- Obsidian's extensibility and markdown-first approach
- Notion's collaboration and database features
- Notesnook's self-hosting model
- Affine's block editor and whiteboard integration

## Why Notesaner Wins (Competitive Advantages)

Based on competitor research, Notesaner addresses the top pain points:

| Pain Point | Competitors | Notesaner Solution |
|------------|-------------|-------------------|
| No web version | Obsidian has no web app | Web-first architecture |
| No real-time collab | Obsidian lacks native collab | Yjs CRDT with cursors, comments |
| Expensive sync | Obsidian: $4-8/mo | Free self-hosted sync |
| SSO behind paywall | Notion: $20/user/mo for SAML | SAML/OIDC included in self-hosted |
| Plugin fragility | Obsidian plugins break on updates | Sandboxed plugins with stable SDK |
| Poor search | Keyword-only, no fuzzy | PostgreSQL FTS + fuzzy + semantic |
| Useless graph view | "Visual toy" at scale | WebGL graph with persistent layouts |
| No public publishing | Obsidian Publish: $8/mo | Built-in free publishing |
| Bad mobile UX | Obsidian mobile: 3/5 rating | Responsive web, no app install |
| Learning curve | Obsidian: "too complex" | Guided onboarding, sane defaults |
| Tinkering trap | Users configure, not write | Built-in features, less plugin dependency |

## Core Requirements

### R1: Note Editor
- **R1.1** WYSIWYG markdown editor (TipTap/ProseMirror)
- **R1.2** Live Preview mode (render markdown inline like Obsidian)
- **R1.3** Source mode (raw markdown editing)
- **R1.4** Slash command menu (`/` to insert blocks)
- **R1.5** Floating toolbar on text selection
- **R1.6** Code blocks with syntax highlighting (50+ languages)
- **R1.7** Math blocks (KaTeX)
- **R1.8** Callout/admonition blocks
- **R1.9** Task lists with nesting and completion tracking
- **R1.10** Advanced table editing (cell-by-cell WYSIWYG, not raw markdown)
- **R1.11** Image embed with resize and alignment
- **R1.12** File attachment drag-and-drop
- **R1.13** Embed support (YouTube, Twitter, generic oEmbed)
- **R1.14** Footnotes
- **R1.15** Horizontal rules
- **R1.16** Block drag handle for reordering
- **R1.17** Keyboard shortcuts (Obsidian-compatible defaults)

### R2: Zettelkasten & Linking
- **R2.1** Wiki links `[[Note Title]]` with autocomplete
- **R2.2** Aliased links `[[Note|Display Text]]`
- **R2.3** Heading links `[[Note#Heading]]`
- **R2.4** Block references `[[Note#^block-id]]`
- **R2.5** Note embeds (transclusion) `![[Note]]`
- **R2.6** Image embeds `![[image.png]]`
- **R2.7** Typed links (continuation, counterargument, example, source) — new!
- **R2.8** Backlinks panel with context
- **R2.9** Unlinked mentions detection
- **R2.10** Automatic link update on note rename
- **R2.11** Broken link detection and repair
- **R2.12** Link preview on hover (popup with note content)

### R3: Knowledge Graph
- **R3.1** Force-directed graph (d3-force)
- **R3.2** WebGL rendering for large vaults (>1000 nodes)
- **R3.3** Persistent/savable layout positions — competitor gap!
- **R3.4** Semantic clustering (not just force physics) — competitor gap!
- **R3.5** Color coding by folder, tag, or custom property
- **R3.6** Node sizing by connection count
- **R3.7** Interactive: click to navigate, hover for preview
- **R3.8** Local graph (current note's neighbors)
- **R3.9** Filters: tag, folder, date, link type, orphan notes
- **R3.10** Create links by drawing edges in graph — competitor gap!
- **R3.11** Search within graph
- **R3.12** Graph view in published/public mode

### R4: Real-Time Sync & Collaboration
- **R4.1** Yjs CRDT for conflict-free editing
- **R4.2** WebSocket transport
- **R4.3** Multi-cursor display with user avatars and colors
- **R4.4** Presence indicators (who's online, who's viewing what)
- **R4.5** Selection awareness (see what others select)
- **R4.6** Inline comments on text ranges
- **R4.7** Comment threads with replies
- **R4.8** @mentions in comments
- **R4.9** Offline editing with auto-merge on reconnect
- **R4.10** IndexedDB local persistence (y-indexeddb)
- **R4.11** Debounced server persistence (500ms → MD file + DB metadata)

### R5: Workspace & Window Management
- **R5.1** Obsidian-like UI: left sidebar + editor + right sidebar
- **R5.2** File explorer tree view (folders + files)
- **R5.3** Tab bar with closable, reorderable tabs
- **R5.4** Per-tab navigation history (Back/Forward) — competitor gap!
- **R5.5** Split panes (horizontal + vertical)
- **R5.6** Snap layout templates (Windows 11 style):
  - 50/50 split
  - 70/30 split
  - 3 columns
  - 2x2 grid
  - Custom ratios
- **R5.7** Drag-and-drop panels with drop zone indicators
- **R5.8** Floating/detachable windows
- **R5.9** Saved workspace layouts (persist per user/workspace)
- **R5.10** Command palette (Cmd/Ctrl+P)
- **R5.11** Quick note switcher (Cmd/Ctrl+O)
- **R5.12** Status bar
- **R5.13** Ribbon (left sidebar icons for quick actions)
- **R5.14** Right sidebar: outline, backlinks, properties, tags
- **R5.15** Keyboard-driven split management

### R6: Authentication & Authorization
- **R6.1** Local email/password auth
- **R6.2** SAML 2.0 (Keycloak, Authentik, generic)
- **R6.3** OIDC (Keycloak, Authentik, generic)
- **R6.4** JWT access + refresh token flow
- **R6.5** RBAC: Owner, Admin, Editor, Viewer roles
- **R6.6** Workspace-level permissions
- **R6.7** Note-level sharing (share with specific users)
- **R6.8** Guest access (read-only links)
- **R6.9** Admin panel for user/provider management
- **R6.10** Optional TOTP 2FA

### R7: Plugin System
- **R7.1** GitHub-based plugin registry
- **R7.2** Tag-based plugin discovery and search
- **R7.3** Sandboxed execution (iframe + postMessage)
- **R7.4** Plugin SDK with typed API
- **R7.5** Stable, versioned, documented API — competitor gap!
- **R7.6** Plugin lifecycle: install, enable, disable, uninstall
- **R7.7** Plugin settings UI (auto-generated from schema)
- **R7.8** Plugin can: register editor extensions, views, commands, sidebar panels
- **R7.9** Hot-reload in development mode
- **R7.10** Built-in plugins in monorepo (can be disabled)

### R8: Public Publishing
- **R8.1** Toggle publish per note
- **R8.2** Public vault with custom URL/slug
- **R8.3** SSR/SSG rendering (SEO-friendly)
- **R8.4** Custom themes for public view
- **R8.5** Auto-generated navigation from folder structure
- **R8.6** Table of contents, breadcrumbs
- **R8.7** Search within published vault
- **R8.8** Graph view in public mode
- **R8.9** Custom domain support
- **R8.10** OpenGraph meta tags
- **R8.11** Analytics (page views per note) — competitor gap!
- **R8.12** Reader comments (optional) — competitor gap!

### R9: Search
- **R9.1** Full-text search (PostgreSQL tsvector)
- **R9.2** Fuzzy search (pg_trgm)
- **R9.3** Search across content, titles, tags, frontmatter
- **R9.4** Ranked relevance (not chronological)
- **R9.5** Highlighted context in results
- **R9.6** Filter by folder, tag, date, author
- **R9.7** Recent searches
- **R9.8** Instant results (no loading spinner)
- **R9.9** Global search (Cmd+Shift+F)

### R10: File Management
- **R10.1** MD files stored on server filesystem
- **R10.2** Admin has direct filesystem access
- **R10.3** File watcher for external changes
- **R10.4** Note versioning with diff view
- **R10.5** Trash with restore (soft delete)
- **R10.6** Bulk move/rename with link updates
- **R10.7** Folder creation and management
- **R10.8** Attachment storage (images, files)
- **R10.9** Drag-and-drop file import
- **R10.10** Export: MD, PDF, DOCX, HTML

## Plugin Requirements (Built-in)

### P1: Excalidraw Plugin
- Embed interactive whiteboards in notes
- Save as `.excalidraw` files
- Real-time collaborative drawing
- Export to PNG/SVG

### P2: Kanban Plugin
- Kanban view from note frontmatter
- Drag-and-drop cards
- Card ↔ note linking
- Custom columns/statuses

### P3: Calendar Plugin
- Month/week/day views
- Daily notes integration
- Event/note date picker
- Recurring notes

### P4: Database Plugin (Notion-like)
- Table, Board, Gallery, List views
- Column types: text, number, date, select, multi-select, relation, formula, checkbox, URL, email
- Sort, filter, group
- Row ↔ note linking
- CSV import/export
- Inline database in notes

### P5: Graph Plugin
- See R3 requirements above

### P6: Slides Plugin
- Convert notes to presentations
- Horizontal rule (`---`) as slide separator
- Speaker notes
- Fullscreen mode

### P7: AI Plugin
- LLM-powered writing assistance
- Note summarization
- Link suggestions based on content
- Auto-tagging
- Semantic search enhancement

### P8: Templates Plugin
- Note templates with variables (date, title, cursor)
- Template picker on new note
- Custom template triggers

### P9: Backlinks Plugin
- See R2.8-R2.9 above

### P10: Daily Notes Plugin
- Auto-create note for today
- Navigate by date
- Weekly/monthly periodic notes
- Template for daily notes

### P11: PDF Export Plugin
- Note → PDF with formatting
- Note → DOCX
- Custom styling for exports
- Batch export

### P12: Mermaid Plugin
- Render Mermaid diagrams inline
- Live preview while editing
- Export diagram as image

### P13: Focus Mode Plugin — new!
- Distraction-free writing
- Hide sidebar, status bar, tabs
- Typewriter scrolling
- Word count goals with progress

### P14: Web Clipper Plugin — new!
- Browser extension to clip web content
- Save as note or append to existing note
- Extract article content (readability)
- Save selection or full page

### P15: Spaced Repetition Plugin — new!
- Create flashcards from notes
- SM-2 algorithm for review scheduling
- Review mode with progress tracking
- Cloze deletions

## Non-Functional Requirements

### NFR1: Performance
- Editor input latency: <16ms
- Note open time: <200ms
- Search response: <200ms
- Graph render (1000 nodes): <1s
- WebSocket latency: <50ms
- Initial page load: <2s (LCP)
- Lighthouse score: >90

### NFR2: Scalability
- Support 100,000+ notes per workspace
- Support 100+ concurrent editors per note
- Support 1000+ WebSocket connections per server

### NFR3: Security
- No hardcoded secrets
- CSP headers for plugin isolation
- CORS properly configured
- Rate limiting on all endpoints
- Input validation at system boundaries
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention (sanitized output)
- File path traversal prevention

### NFR4: Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation throughout
- Screen reader support
- Color contrast ratios
- Focus indicators

### NFR5: Internationalization
- English default
- next-intl for translations
- RTL layout support (future)
- Date/number formatting by locale
