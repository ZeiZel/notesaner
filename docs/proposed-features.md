# Notesaner — Proposed Features Beyond Obsidian

Features inspired by competitor research and user pain points analysis.

## Tier 1: High Impact (Address Critical Pain Points)

### 1. Guided Onboarding Wizard
**Pain**: Obsidian "too complex for normal people", blank vault with no guidance.
- Interactive first-run tutorial
- Pre-built vault templates (GTD, Zettelkasten, Research, Team Wiki)
- Progressive feature disclosure (unlock features as user grows)
- Tooltip hints for first-time use of each feature

### 2. Content Freshness System (Enterprise Killer Feature)
**Pain**: "Most company wikis suck" — nobody maintains docs.
- Document owner assignment
- Automated staleness detection (configurable: 30/60/90 days)
- "Last verified" badge with reviewer name
- Notification to owner when document gets stale
- "Needs review" queue in admin panel
- Version comparison to see what changed since last review

### 3. Semantic Search (AI-Powered)
**Pain**: "Search function needs to be rewritten" — all competitors fail here.
- PostgreSQL FTS for keyword search (baseline)
- Embedding-based semantic search (local model or API)
- Natural language queries: "What did I write about X?"
- Similar notes suggestion
- Context-aware results ranked by relevance

### 4. Instant Quick Capture
**Pain**: Obsidian mobile takes 5 min to load, can't capture thoughts fast.
- Floating capture button (always accessible)
- Instant-open capture modal (no vault loading required)
- Capture → auto-file into inbox folder
- Keyboard shortcut (Cmd+N) opens minimal editor
- PWA support for mobile home screen

### 5. Smart Note Import
**Pain**: Migration between note apps is painful.
- Import from: Obsidian vault, Notion export, Logseq, Roam, Evernote, Bear, Apple Notes
- Preserve links, tags, frontmatter, attachments
- Migration wizard with progress and conflict resolution
- Dry-run preview before import

## Tier 2: Differentiating Features

### 6. Typed Links (Zettelkasten Enhancement)
**Pain**: All links are flat in Obsidian, no semantic relationships.
- Link types: `relates-to`, `contradicts`, `supports`, `extends`, `example-of`, `source`
- Visual distinction in backlinks panel
- Graph view color-codes by link type
- Filter graph by relationship type
- Custom link types (user-defined)

### 7. Block-Level Operations
**Pain**: Obsidian is page-centric, Logseq block-centric. Best of both worlds.
- Block references across notes
- Block embeds (live transclusion)
- Block-level comments
- Block-level sharing (share specific section)
- Block drag between notes

### 8. Timeline View
**Pain**: No temporal view of knowledge creation.
- Chronological view of note creation/modification
- Filter by date range
- See what you wrote each day/week/month
- "On this day" feature (notes from same day in previous years)

### 9. Smart Workspace Templates
**Pain**: Users spend hours configuring layouts.
- Pre-built workspaces: "Research Mode", "Writing Mode", "Review Mode"
- Research: split view with source + notes
- Writing: focus mode with outline
- Review: backlinks + graph + editor
- Save custom workspaces, share with team

### 10. API & Webhooks
**Pain**: No integration options in most note apps.
- REST API for CRUD operations
- Webhook events (note created, edited, published)
- Zapier/n8n integration ready
- CLI tool for scripting

### 11. Note Activity Feed
**Pain**: In teams, hard to see what changed.
- Activity stream: who edited what, when
- Per-note edit history with diffs
- @mentions in notes notify users
- Follow notes for change notifications

### 12. Multi-Vault Support
**Pain**: Users want separate vaults for work/personal.
- Multiple workspaces per account
- Switch between workspaces instantly
- Cross-workspace search (optional)
- Different auth providers per workspace

## Tier 3: Nice-to-Have

### 13. Voice Notes with Transcription
- Record audio directly in a note
- Auto-transcribe using Whisper (local or API)
- Searchable transcription text

### 14. OCR for Images
- Extract text from images
- Make image content searchable
- Useful for handwritten notes, screenshots

### 15. Git Integration
- Version control via git (optional)
- Push/pull from remote repository
- Git-based backup strategy

### 16. Web Clipper Browser Extension
- Clip articles, selections, full pages
- Save to specific folder with tags
- Reader mode extraction

### 17. Custom CSS/Themes
- Theme editor built-in
- CSS snippet support (like Obsidian)
- Theme marketplace (community themes)
- Dark/light mode + auto system theme

### 18. Reading Mode
- Clean, distraction-free reading view
- Adjustable font size, line height, width
- Progress indicator for long notes

### 19. Note Relationships Map
- Beyond simple graph: show typed relationships
- Hierarchical view (parent → child)
- Cluster view (groups of related notes)
- Timeline overlay on graph

### 20. Audit Log (Enterprise)
- Track all actions: login, edit, share, publish
- Export logs for compliance
- Configurable retention period
- IP tracking, device info

## Summary: What Makes Notesaner Unique

The combination of these features creates a product that doesn't exist today:

1. **Web-first** — No Electron required, works on any device with a browser
2. **Collaborative by default** — Real-time editing with cursors, not a bolt-on
3. **Self-hostable** — SAML/OIDC included, not behind a paywall
4. **Plugin system with stable SDK** — Sandboxed, documented, versioned API
5. **Graph that works** — Persistent layouts, semantic clustering, WebGL performance
6. **Search that understands** — Fuzzy + full-text + semantic
7. **Content freshness** — Enterprise wiki killer feature no one has
8. **Typed links** — True Zettelkasten with semantic relationships
9. **Free publishing** — Built-in, no $8/month add-on
10. **Instant access** — No 5-minute vault loading, no app install required
