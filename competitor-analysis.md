# Competitive Analysis: Note-Taking Applications

**Date**: 2026-03-24
**Focus**: Architecture decisions, encryption models, pain points, and differentiation

---

## Executive Summary

The note-taking market in 2025-2026 has fragmented along clear philosophical lines: **cloud-first** (Notion), **local-first with optional sync** (Obsidian, AFFiNE, Anytype), **privacy-first with E2EE** (Notesnook), and **outliner-native** (Logseq). Each architectural choice introduces fundamental trade-offs in collaboration, performance, and user experience.

Notesnook bets on zero-knowledge encryption as its moat but suffers from chronic sync reliability issues and a lack of developer API. AFFiNE is the most technically ambitious project -- combining a Rust CRDT engine (OctoBase/y-octo) with a TypeScript block editor (BlockSuite) and an infinite canvas -- but is still maturing and lacks a plugin ecosystem. Notion remains dominant for teams but faces growing backlash over performance degradation with large databases, forced AI bundling, and limited offline support. Logseq and Anytype serve niche but passionate user bases with their outliner and object-graph paradigms respectively.

The biggest unserved gap across all competitors: **reliable offline-first sync with strong encryption that just works, combined with a developer-friendly API and extensibility model.**

---

## 1. Notesnook -- Deep Dive

### 1.1 Server Architecture & Sync Model

**Server Stack**: .NET (C#), AGPLv3 licensed

**Multi-Service Architecture** (5 services):

| Service | Port | Role |
|---------|------|------|
| Notesnook Server | 5264 | Main sync API |
| Identity Server | 8264 | Authentication |
| SSE Server | 7264 | Real-time sync via Server-Sent Events |
| Attachments Server | 6264 | File/attachment handling |
| MongoDB 7.0 | default | Primary data store (replica set) |
| MinIO | 9000/9090 | S3-compatible object storage for attachments |

**Sync Flow**:
- Data stored locally in IndexedDB on clients
- On sync, each item is individually encrypted then sent to the server
- Server stores encrypted blobs in MongoDB -- it never sees plaintext
- SSE (Server-Sent Events) used for real-time push updates to clients
- Sync uses locks (not semaphores) for managing concurrent device sync
- Recent addition: `LastAccessTime` tracking to prune stale sync devices

**Key Architecture Decision**: Choosing SSE over WebSockets for real-time sync is a simpler, more HTTP-friendly approach but limits bidirectional communication. This is a pragmatic choice for a privacy-focused app where the server's role is minimal (just storing and forwarding encrypted blobs).

### 1.2 Encryption Approach (E2EE)

**Cryptographic Foundation**: libsodium (cross-platform)

**Algorithms**:
- **Encryption**: XChaCha20-Poly1305-IETF (authenticated encryption)
- **Key Derivation**: Argon2i (for key derivation), Argon2id (for password hashing)

**Authentication & Key Flow**:

```
SIGN-UP / SIGN-IN:
1. Password hashed locally with Argon2
   Salt = fixed_client_salt + user_email (predictable, per-user)
2. Hash sent to server (password never transmitted in plaintext)
3. Server hashes again (prevents password passthrough attacks)

KEY GENERATION:
1. Server returns a randomly-generated per-user salt
2. Client derives encryption key: Argon2(password, server_salt)
3. Key NEVER leaves the device

KEY STORAGE:
- Desktop/Web: browser CryptoKey objects in IndexedDB (non-exportable)
- Mobile: native device keychain (iOS Keychain / Android Keystore)
```

**Per-Item Encryption**:
1. Database item read as JSON object
2. JSON stringified
3. Encrypted with XChaCha20-Poly1305-IETF using derived key
4. Output: base64-encoded ciphertext + 192-bit nonce + random salt + algorithm ID + item ID
5. Encrypted payload sent to server

**Verification**: Open-source tool called **Vericrypt** lets users independently verify encryption claims offline.

**2FA Support**: SMS, TOTP, or email-based two-factor authentication.

**Architecture Decision**: Encrypting each item independently (rather than the entire database) allows granular sync -- only changed items need to be transmitted. The trade-off is that metadata like note count, modification timestamps, and organizational structure may be partially visible to the server depending on implementation.

### 1.3 Self-Hosting

**Status**: Alpha (as of March 2026)

**Roadmap Progress**: 3 of 4 steps complete; step 4 is documentation.

**Requirements**:
- Linux server with Docker + Docker Compose
- Domain name with subdomain capability
- Ports: 5264, 6264, 7264, 8264, 9090, 9009
- SMTP server for email notifications (auth codes, etc.)

**Key Environment Variables**:
- `INSTANCE_NAME` -- unique identifier
- `NOTESNOOK_API_SECRET` -- random API auth token
- `DISABLE_ACCOUNT_CREATION` -- restrict signups
- SMTP config (`SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`)
- Public URLs for auth, app, monograph, and attachments servers

**Known Self-Hosting Issues**:
- MinIO integration problems (network errors, 0-byte files)
- MongoDB replica set initialization takes ~60 seconds
- Some paid subscription features may still be gated even on self-hosted instances
- Community has created unofficial full Docker stacks (BeardedTek/notesnook-docker) to fill documentation gaps

### 1.4 Notesnook vs. Obsidian -- Key Differences

| Dimension | Notesnook | Obsidian |
|-----------|-----------|----------|
| **Core philosophy** | Privacy & encryption first | Knowledge management & linking |
| **Open source** | Yes (GPLv3) | No (proprietary) |
| **Note format** | Proprietary internal format (Markdown shortcuts in editor) | Plain .md files on disk |
| **E2E Encryption** | Built-in, default, zero-knowledge | Only via paid Obsidian Sync ($8/mo) |
| **Plugin ecosystem** | None | 1000+ community plugins |
| **Knowledge graph** | No | Yes (graph view, backlinks, wikilinks) |
| **Sync cost** | Included in Pro ($2.92-$6.99/mo) | $8/mo for Obsidian Sync or DIY |
| **Data portability** | Export required | Files already on your disk |
| **Mobile experience** | Good, native feel | Functional but heavier |
| **Self-hosting** | Sync server available (alpha) | N/A (local files, sync DIY) |
| **Target user** | Privacy-conscious note-takers | Power users, PKM enthusiasts |

**Key Insight**: Obsidian's moat is its plugin ecosystem and plain-file format. Notesnook's moat is built-in E2EE. They serve fundamentally different user motivations -- Notesnook users fear surveillance; Obsidian users fear vendor lock-in.

### 1.5 User Complaints & Missing Features

**Sync Reliability (Critical, Ongoing)**:
GitHub issues #7753, #7887, #7618, #7659, #7931, #8368, #8417 all document sync failures in 2025:
- Cross-device sync silently drops edits (desktop edits lost to mobile state)
- Conflict detection that existed in older versions has regressed
- Intermittent reliability: "works sometimes, crashes other times"
- Data loss: user reported losing 2 hours of work with no recovery
- Auth server connection failures blocking sync entirely
- Affects both free and paid users

**Paywalling Previously Free Features (Trust Issue)**:
- October 2025: checklist feature moved behind paywall
- App password lock became Pro-only -- criticized as "charging for basic security"
- Particularly harmful given Notesnook's privacy-first brand positioning

**Missing Features**:
- No public developer API
- No third-party security audit completed
- No collaboration features
- No premade templates
- Limited export capabilities for offline use
- No plugin/extension system
- No backlinks or knowledge graph
- Limited developer responsiveness to support emails

### 1.6 Authentication Design

- Email + password authentication with Argon2 hashing
- Server never receives plaintext password
- 2FA via SMS, TOTP apps, or email
- Identity Server runs as a separate microservice (port 8264)
- Monograph sharing uses separate temporary session tokens (distinct from master decryption key)

### 1.7 API Design

**There is no public REST API for third-party developers.** This is a notable gap.

- The sync server exposes internal endpoints (`/health`, `/version`)
- The codebase is a monorepo (React, React Native, Electron) with shared internal APIs
- Developers must read source code to understand internal interfaces
- Homebrew cask exposes a JSON metadata endpoint, but this is not a content API

---

## 2. AFFiNE -- Deep Dive

### 2.1 Architecture & Tech Stack

**Organization**: Toeverything (Singapore-based)
**License**: MIT
**GitHub Stars**: 60k+

**Three-Layer Architecture**:

```
+--------------------------------------------------+
|  APPLICATION LAYER (TypeScript)                   |
|  Next.js SPA + React + Electron + Mobile          |
|  @affine/core (app logic)                         |
|  @affine/component (reusable UI)                  |
|  Jotai (state management)                         |
+--------------------------------------------------+
|  EDITOR LAYER (TypeScript)                        |
|  BlockSuite                                       |
|  - Page Editor (document mode)                    |
|  - Edgeless Editor (canvas/whiteboard mode)       |
|  - Extension System (Inline/Block/Gfx/Widget/     |
|    Fragment)                                      |
+--------------------------------------------------+
|  DATA LAYER (Rust)                                |
|  OctoBase (collaborative database)                |
|  y-octo (CRDT engine, Yjs-compatible)             |
|  napi-rs bindings (Rust <-> Node.js bridge)       |
|                                                   |
|  Storage: SQLite (local), PostgreSQL (server),    |
|  Redis (cache/queues), S3 (blobs),                |
|  Elasticsearch (search)                           |
+--------------------------------------------------+
```

**Key Architecture Decisions**:

1. **TypeScript + Rust split**: Performance-critical CRDT operations and data persistence run in Rust (compiled to native Node addons via napi-rs). UI and editor logic stay in TypeScript. This is architecturally similar to how Figma uses C++/WASM for its rendering engine.

2. **BlockSuite as a separate project**: The editor framework is decoupled from AFFiNE itself, allowing it to be used in other applications. This is a bet on becoming an infrastructure provider, not just an app.

3. **Unidirectional data flow**: Store -> Model -> View -> Action -> Store. Classic React-style pattern applied to the entire document model.

4. **y-octo replacing yrs**: AFFiNE initially used yrs (Rust Yjs port) but built their own implementation (y-octo) for better performance and thread safety. This is binary-compatible with Yjs, allowing interop with the broader Yjs ecosystem.

### 2.2 Block-Based Editor (BlockSuite)

**Document Model**: Block trees with root blocks at top level, leaf blocks at terminal positions, and surface blocks for whiteboard components.

**Extension System** (5 categories):

| Type | Purpose | Examples |
|------|---------|----------|
| Inline | Rich text within blocks | Bold, italic, highlight, links |
| Block | Document composition units | Paragraph, list, code, database |
| Gfx | Whiteboard elements | Shape, brush, frame, connector |
| Widget | Editing assistance tools | Slash menu, toolbar, drag handle |
| Fragment | Information panels | Title panel, outline, link panel |

**Key Design Choice**: BlockSuite breaks content into discrete `contenteditable` blocks rather than using a monolithic rich-text container (like ProseMirror or Slate typically do). This avoids the complex selection and range management problems that plague traditional rich-text editors, at the cost of more complex block-level coordination.

### 2.3 Whiteboard/Canvas Integration ("Edgeless Mode")

**Core Innovation**: Documents and whiteboards are the SAME object. A "page" is just a database of blocks with a preferred view mode.

**How it works**:
1. Write in document mode (structured, linear)
2. Click "Edgeless" -- boundaries disappear, content becomes blocks on infinite canvas
3. Add mind maps, sticky notes, images, shapes around existing text
4. Any block type can exist on the canvas (including databases, embedded pages)
5. Blocks can be connected with lines, arrows, visual cues

**Rendering**: Canvas-based renderer (not DOM) for whiteboard elements, achieving 60fps with thousands of vector shapes and text blocks. This avoids the DOM-heavy lag common in web-based whiteboard tools.

**Architecture Significance**: Most competitors (Notion, Obsidian) treat documents and visual canvases as fundamentally different things. AFFiNE's unified block model is technically harder but eliminates context-switching. The risk is that doing both means doing neither perfectly.

### 2.4 Real-Time Collaboration

**CRDT Stack**: y-octo (Rust) -> OctoBase -> BlockSuite

**Sync Protocol**:
- State vector-based synchronization: each client maintains a map of `client_id -> clock`
- Server computes diffs using state vectors, transmits only missing updates
- WebSocket gateway (Socket.io) for real-time sync
- Redis pub/sub adapter for horizontal scaling across server instances
- Awareness protocol for collaborative presence (cursors, selections)

**Offline Support**:
- All edits stored locally as CRDT operations
- On reconnect, CRDT merge resolves conflicts mathematically (no manual conflict resolution)
- OctoBase's P2P protocol also supports direct device-to-device sync without server

**Architecture Decision**: Using CRDTs (specifically Yjs-compatible) rather than OT (Operational Transform, used by Google Docs) means AFFiNE can support true offline-first editing with guaranteed convergence. The trade-off is larger document state and more complex garbage collection.

### 2.5 What Makes AFFiNE Unique

1. **Docs + Whiteboard = Same Thing**: No other major competitor has achieved this level of integration
2. **Rust CRDT engine**: Most competitors use JS-only CRDT implementations; Rust gives better performance
3. **BlockSuite as infrastructure**: The editor framework is independently reusable
4. **MCP (Model Context Protocol) support**: External AI tools (Cursor, Claude Desktop) can read/interact with AFFiNE workspace
5. **Local AI integration**: Can connect to Ollama/Open WebUI for fully local AI processing

### 2.6 User Complaints & Missing Features

**Maturity Issues (Primary Concern)**:
- Lag and small bugs remain common
- Missing basics: stronger search, PDF export, backlinks, tags
- Table blocks disappeared after v0.25 upgrade (data loss)
- Images failing to load in PDF exports

**AI Workflow Problems**:
- "Improve with AI" returns content unrelated to selected text
- Multi-step AI process: select -> "Ask AI" -> "Continue with AI" -> side panel
- AI often returns markdown format unexpectedly
- No monthly AI subscription option (annual only)
- Users describe AI as "an assistant that doesn't actually assist"

**Plugin/Extension Ecosystem**:
- No public plugin marketplace yet ("coming soon" since 2024)
- Internal extension system (BlockSuite) is well-structured but developer-facing
- Community has built CLI tools (affine-reader, affine-exporter, affine-importer) but no official plugin API
- Compared to Obsidian's 1000+ plugins, this is a significant gap

**Other Complaints**:
- Text too small in app, causing eye strain (no easy scaling)
- Mobile apps functional but desktop experience is notably better
- Graph view missing
- Richer mobile features needed

### 2.7 Plugin/Extension System Status

**Internal Architecture** (via BlockSuite): Well-defined 5-category extension system (Inline, Block, Gfx, Widget, Fragment) that powers all built-in features.

**Public Plugin API**: Does not exist yet. The community has been requesting a plugin system since at least 2023. AFFiNE's position is that "plugin community and third-party blocks are coming soon" and users can self-host and fork in the meantime.

**Community Workarounds**:
- affine-reader: reads BlockSuite YJS format, converts to markdown
- affine-exporter: CLI export to markdown files
- affine-importer: data import tool
- affine-ghost: migration tool

---

## 3. Brief Coverage: Notion, Logseq, Anytype

### 3.1 Notion

**What People Love**:
- Database views are the killer feature: same data as Kanban, Gallery, Calendar, Table, Timeline
- Linked databases with relational data (e.g., Tasks linked to Clients linked to Projects)
- Replaced Confluence + Airtable + Trello for many teams
- 20,000+ templates, Notion Forms for direct database input
- AI features work well for summarization and action items

**What People Hate**:
- **Performance cliff with large databases**: Noticeable degradation past ~5,000 records
- **Offline mode is still incomplete**: Added August 2025 but only covers basic blocks; "they still can't work offline" is a persistent complaint
- **Forced AI bundling**: May 2025 pricing change bundled AI only into Business tier; Plus customers lost standalone AI add-on option; no way to disable AI without contacting support
- **"Notion Paralysis"**: Users spend hours designing workspace structure, never actually use it
- **Permission management at scale**: Complex databases and department-wide templates are "a headache to support"
- **Formula system less capable than Coda**
- **Steep learning curve**: ~2 weeks for new team members to grasp databases, rollups, relations

**Architecture Note**: Cloud-first, proprietary. Data stored on Notion's servers. No self-hosting. Limited API (read/write but not real-time). This is the fundamental trade-off: Notion optimizes for team collaboration at the expense of privacy, offline support, and data sovereignty.

### 3.2 Logseq

**The Outliner Approach**:
- Everything is a bullet point (block). Every note is a collection of referenceable blocks.
- Daily journals auto-created each morning as the primary entry point
- Block references and queries create a networked knowledge graph without explicit linking
- TODO/DOING/DONE workflow built into the query system
- Files stored locally as .md or .org

**What's Good**:
- "Transformative" for users whose thinking naturally aligns with hierarchical outlines
- Fast, low-friction capture -- just start typing bullets
- Built-in flashcards (SRS) excellent for students
- Backlinks and graph view without plugins
- Free and open source
- Local files = privacy by default

**What's Bad**:
- **The outliner paradigm is polarizing**: "Clicks immediately for some, never clicks for others"
- **Steep learning curve**: Users report needing ~1 year to develop effective patterns
- **Poor mobile experience**: Electron-based, heavy, less responsive
- **No collaboration features**: No official team sync; third-party cloud sync causes conflicts
- **Performance degrades with large graphs**
- **Flat structure feels chaotic** for reference material that wants clear hierarchy
- **Constraining for prose writing**: Everything forced into bullet format

**Architecture Note**: Currently transitioning from file-based to database-first architecture (2025-2026). This is a major architectural migration intended to improve sync reliability and performance with large journals. The migration is still in progress and represents significant technical risk.

### 3.3 Anytype

**Local-First Architecture**:
- Built on Anypuri protocol and IPFS (content-addressable, peer-to-peer)
- Everything is an **Object** with **Types** and **Relations** (not files, not pages)
- Graph-based data model where objects link to each other
- P2P sync (Any-Sync protocol) -- no central server required
- Zero-knowledge: Anytype cannot decrypt user data; if you lose your recovery phrase, data is unrecoverable

**What Makes It Unique**:
- Most credible "local-first + P2P" implementation in the space
- Object-Type-Relation model is more flexible than pages/folders
- Snappy performance due to true local-first (no loading spinners)
- No central server dependency

**Complaints**:
- **Steep learning curve**: "Object-Type-Relation" mental model is unfamiliar and complex
- **Limited search functionality**: Multiple users report inadequate search
- **Collaboration is weak**: Multiplayer is "the feature that makes Anytype so challenging to develop"
- **No integrations**: Intentionally avoids Zapier/Make-style automation hooks
- **No multi-tab support** (finally added February 2026)
- **Data export issues**: Reported by multiple users
- **Data recovery impossible if recovery phrase is lost**: Zero-knowledge trade-off

**Architecture Note**: Their 2019 IPFS prototype "flooded the network at their Berlin office, making it barely usable." They have since moved to their own Any-Sync protocol. This is the classic tension of P2P systems: the principles are sound but the engineering to make them performant and reliable is extremely hard.

---

## 4. Cross-Cutting Architecture Comparison

### 4.1 Data Model Comparison

| App | Data Model | Storage Format | Portability |
|-----|-----------|----------------|-------------|
| Notesnook | Rich text (JSON internally) | Encrypted blobs in MongoDB | Export required |
| AFFiNE | Block tree (CRDT) | CRDT state in SQLite/Postgres | Community export tools |
| Notion | Block tree (proprietary) | Cloud-only | API + export |
| Logseq | Outliner blocks | .md / .org files on disk | Native (plain files) |
| Anytype | Object graph | IPFS-based, local | Difficult |
| Obsidian | Documents | .md files on disk | Native (plain files) |

### 4.2 Sync Architecture Comparison

| App | Sync Mechanism | Offline-First | Conflict Resolution |
|-----|---------------|---------------|---------------------|
| Notesnook | SSE + REST (encrypted blobs) | Partial (local IndexedDB) | Conflict detection (regressed) |
| AFFiNE | WebSocket + CRDT (y-octo) | Yes (CRDT-native) | Automatic (CRDT merge) |
| Notion | Proprietary cloud sync | Limited (basic blocks only) | Server-authoritative |
| Logseq | File sync (DIY or paid) | Yes (local files) | Manual / broken with cloud sync |
| Anytype | P2P (Any-Sync protocol) | Yes (P2P native) | CRDT-like (Any-Sync) |

### 4.3 Encryption Comparison

| App | E2EE | Algorithm | Zero-Knowledge |
|-----|------|-----------|----------------|
| Notesnook | Yes (default) | XChaCha20-Poly1305 + Argon2 | Yes |
| AFFiNE | No (local-first but not encrypted at rest by default) | N/A | No |
| Notion | No | N/A | No |
| Logseq | No (local files, not encrypted) | N/A | N/A (no server) |
| Anytype | Yes | Custom (Any-Sync) | Yes |

### 4.4 Extensibility Comparison

| App | Plugin System | API | Custom Blocks |
|-----|--------------|-----|---------------|
| Notesnook | None | None | No |
| AFFiNE | Internal only (BlockSuite extensions) | None (public) | Yes (via source) |
| Notion | Connections + Automations | REST API (read/write) | No |
| Logseq | Plugin system (community) | Limited | Yes (via plugins) |
| Anytype | None | None | No |
| Obsidian | 1000+ plugins | None (file-based) | Yes (via plugins) |

---

## 5. Key Pain Points Across the Market

### 5.1 Unsolved Problems

1. **Sync that actually works**: Every app except Notion has significant sync complaints, and Notion solves it by being cloud-only (which creates other problems)

2. **Encryption without UX penalty**: Notesnook proves E2EE is possible but at the cost of sync reliability and no API/extensibility. No one has achieved "encryption that's invisible and fully reliable"

3. **Plugin ecosystem + privacy**: Obsidian has plugins but no E2EE by default. Notesnook has E2EE but no plugins. No one has both

4. **Offline + collaboration**: AFFiNE is closest with CRDTs but still maturing. True offline collaboration with conflict-free merging remains hard in production

5. **Mobile as a first-class citizen**: Every app treats mobile as secondary to desktop. Mobile capture remains a universal weak point

### 5.2 Architecture Trade-offs Summary

| Trade-off | Who chose what |
|-----------|---------------|
| Cloud-only vs. Local-first | Notion (cloud) vs. everyone else (local) |
| E2EE vs. Features | Notesnook (E2EE, fewer features) vs. AFFiNE (features, no E2EE) |
| CRDT vs. Simpler sync | AFFiNE/Anytype (CRDT) vs. Notesnook (REST+SSE) |
| Plugin ecosystem vs. Simplicity | Obsidian (plugins) vs. Notesnook/Anytype (no plugins) |
| Plain files vs. Database | Obsidian/Logseq (files) vs. AFFiNE/Notion (database) |
| Docs+Canvas unified vs. Separate | AFFiNE (unified) vs. everyone else (separate or none) |

---

## 6. Strategic Observations

1. **Notesnook's biggest risk** is sync reliability undermining its privacy promise. Users who lose data will leave regardless of encryption quality. The .NET/C# server stack is also unusual in this space (most competitors use TypeScript or Rust), which may limit contributor pool.

2. **AFFiNE's biggest risk** is trying to do everything (docs + whiteboard + database + AI + collaboration) before doing any one thing excellently. The technical foundation (Rust CRDT + TypeScript editor) is arguably the strongest in the space, but the lack of a plugin ecosystem and maturity issues could stall adoption.

3. **The CRDT bet is paying off**: AFFiNE and Anytype's investment in CRDT-based sync is increasingly validated as users demand offline-first capabilities. Notesnook's simpler REST+SSE approach is showing strain.

4. **No one has won developer extensibility**: Obsidian leads with plugins but is proprietary and lacks E2EE. The first open-source, encrypted note app with a strong plugin API will capture significant mindshare.

5. **AI integration is becoming table stakes** but execution varies wildly. AFFiNE's MCP support (letting external AI tools access the workspace) is architecturally more interesting than Notion's built-in AI, because it's composable rather than monolithic.

---

## Data Sources

- [Notesnook GitHub Repository](https://github.com/streetwriters/notesnook)
- [Notesnook Sync Server Repository](https://github.com/streetwriters/notesnook-sync-server)
- [Notesnook Encryption Documentation](https://help.notesnook.com/how-is-my-data-encrypted)
- [AFFiNE GitHub Repository](https://github.com/toeverything/AFFiNE)
- [AFFiNE Architecture Docs](https://docs.affine.pro/blocksuite-wip/architecture)
- [AFFiNE BlockSuite Docs](https://docs.affine.pro/core-concepts/blocks-that-assemble-your-next-docs-tasks-kanban-or-whiteboard)
- [OctoBase Repository](https://github.com/toeverything/OctoBase)
- [OctoBase Documentation](https://octobase.dev/)
- [y-octo Repository](https://github.com/y-crdt/y-octo)
- [AFFiNE DeepWiki - Real-time Synchronization](https://deepwiki.com/toeverything/AFFiNE/3.5-real-time-synchronization)
- [AFFiNE vs AppFlowy vs Anytype Comparison](https://affine.pro/blog/affine-vs-appflowy-vs-anytype)
- [AFFiNE 60-Day Review (2026)](https://www.fahimai.com/affine-pro)
- [AFFiNE Product Hunt Reviews](https://www.producthunt.com/products/affine-2/reviews)
- [Notesnook Self-Hosting Tutorial (Lemmy)](https://lemmy.world/post/24509570)
- [Self-Hosting Notesnook (XDA Developers)](https://www.xda-developers.com/self-hosting-notesnook-instance-why-better/)
- [Notesnook Sync Server Docker Compose](https://github.com/streetwriters/notesnook-sync-server/blob/master/docker-compose.yml)
- [Notesnook Review (AcademicHelp)](https://academichelp.net/note-taking-apps/notesnook-review.html)
- [Notesnook Trustpilot Reviews](https://www.trustpilot.com/review/notesnook.com)
- [Obsidian vs Notesnook (Privacy Guides)](https://discuss.privacyguides.net/t/obsidian-vs-notesnook-which-one-should-i-use-or-both/25909)
- [Notion Review (Hackceleration, 2026)](https://hackceleration.com/notion-review/)
- [Notion Capterra Reviews](https://www.capterra.com/p/186596/Notion/reviews/)
- [Logseq Product Hunt Reviews](https://www.producthunt.com/products/logseq/reviews)
- [Obsidian vs Logseq 2026](https://thesoftwarescout.com/obsidian-vs-logseq-2026-which-note-taking-app-wins/)
- [Anytype 2026 Review](https://www.fahimai.com/anytype)
- [Anytype Roadmap Update Feb 2026](https://community.anytype.io/t/roadmap-update-2026-feb/30112)
- [Anytype Blog - Journey and Plans](https://blog.anytype.io/our-journey-and-plans-for-2025/)
- [BrightCoding - Notesnook Developer Review](http://www.blog.brightcoding.dev/2026/02/11/notesnook-the-privacy-first-tool-every-developer-needs)
- [Notesnook GitHub Issue #8368 - Data Loss](https://github.com/streetwriters/notesnook/issues/8368)
- [Notesnook GitHub Issue #7753 - Sync Issue](https://github.com/streetwriters/notesnook/issues/7753)
- [AFFiNE GitHub Issue #13750 - Missing Table Blocks](https://github.com/toeverything/AFFiNE/issues/13750)
- [AFFiNE Sealos Deployment Guide](https://sealos.io/blog/how-to-deploy-affine-open-source-notion-alternative/)
- [AFFiNE BetterStack Guide](https://betterstack.com/community/guides/linux/affine/)
