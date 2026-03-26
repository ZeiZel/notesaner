# Obsidian Deep Dive: Features, Ecosystem, and Pain Points

**Date**: 2026-03-24
**Focus**: Competitive intelligence for building a note-taking alternative

---

## 1. Core Features That Made Obsidian Successful

### Why People Love It

Obsidian has built a fiercely loyal user base around a few key principles that differentiate it from every major competitor:

**Local-First, Plain-Text Markdown Storage**
Every note is a `.md` file stored on the user's local filesystem. No proprietary format, no cloud lock-in, no subscription required to access your own data. Notes created in 2025 will be readable in 2045 regardless of whether Obsidian the company exists. This philosophy resonates deeply with privacy-conscious users, academics, and anyone burned by vendor lock-in (Evernote refugees, for example).

**Bidirectional Links and Backlinks**
The `[[double bracket]]` linking syntax is the core mechanic. Linking two notes automatically creates a backlink, building a navigable web of interconnected ideas without manual indexing. This was the feature that initially attracted the Roam Research crowd.

**Free Forever (for personal use)**
The core app has no feature limitations, no time restrictions, and no advertising for personal use. Revenue comes solely from optional Sync ($4-8/month) and Publish ($8-10/month) services, plus commercial licenses.

**Extreme Extensibility**
Over 2,500+ community plugins as of March 2026, with 2,700+ themes. Users can shape Obsidian into a task manager, CRM, spaced repetition system, writing studio, or research database. This extensibility is Obsidian's defining competitive moat.

**Vault System**
Each vault is just a folder on disk. Users can have multiple vaults with different configurations, themes, and plugin sets. Everything lives in `.obsidian/` inside that folder.

**Graph View**
Visual representation of the knowledge graph -- nodes are notes, edges are links. Marketed as one of Obsidian's signature features and a key draw for new users.

### Key Success Metrics (2025-2026)

- Over 2,500 community plugins
- Excalidraw plugin alone: 5.6M all-time downloads
- Dataview: 3.8M downloads
- Active weekly plugin development: 50-100 plugin updates per week
- Desktop experience rated 4.5/5 by community (2026 Report Card)
- Free for personal AND commercial use as of February 2025

---

## 2. Plugin Ecosystem

### Architecture

**Three-Tier System:**
1. **Core plugins** -- bundled with app, officially supported (Daily Notes, Templates, Outline, Backlinks, Graph View, Search, etc.)
2. **Community plugins** -- distributed via GitHub Releases, installed through in-app browser
3. **Obsidian-maintained community plugins** -- maintained by core team but distributed as community plugins

**Technical Details:**
- Plugins are written in TypeScript/JavaScript
- They extend the `Plugin` class (which inherits from `Component`)
- Lifecycle: `onload()` for registration, `onunload()` for cleanup (mostly automatic)
- Every plugin gets access to the `App` object via `this.app`, providing access to:
  - `Vault` -- file/folder operations
  - `Workspace` -- pane/tab management
  - `MetadataCache` -- cached metadata (headings, links, embeds, tags, blocks)
- Plugin files live in `.obsidian/plugins/<plugin-id>/` containing `main.js`, `manifest.json`, and optional `styles.css`
- The `obsidian` API package is excluded from bundles; provided at runtime by the app
- **No granular permission system** -- plugins have full access to the API (security concern)

**Inter-Plugin Communication:**
- Method 1: Export API to global namespace
- Method 2: Access via `plugin.app.plugins.plugins["plugin-id"]?.api`
- No formal plugin-to-plugin protocol

**Distribution:**
- All community plugins are open-source on GitHub
- Obsidian downloads release artifacts from GitHub
- Users must explicitly enable community plugins and trust them

### Most Popular Plugins (All-Time Downloads, Early 2026)

| Rank | Plugin | Downloads | Purpose |
|------|--------|-----------|---------|
| 1 | Excalidraw | 5,629,013 | Drawing/diagramming |
| 2 | Templater | 3,875,993 | Advanced templating with JS |
| 3 | Dataview | 3,830,135 | Query vault as a database |
| 4 | Tasks | 3,217,171 | Task management |
| 5 | Advanced Tables | 2,667,494 | Table editing |
| 6 | Calendar | 2,445,355 | Calendar view for daily notes |
| 7 | Git | 2,277,494 | Version control sync |
| 8 | Kanban | 2,160,767 | Kanban boards |
| 9 | Style Settings | 2,156,417 | Theme customization |
| 10 | Iconize | 1,906,580 | Custom icons |

### Plugin Ecosystem Problems

**Abandonment Risk:**
Developers stop updating plugins, and they break with new Obsidian versions. There is no formal deprecation or compatibility-flagging system (unlike WordPress). Users have requested WordPress-style "tested up to version X" compatibility statements but these do not exist.

**No Permission System:**
Community plugins execute within the Electron context with full API access. There is no sandboxing or granular permission model. Users must trust or audit the source code.

**Decision Fatigue:**
2,500+ plugins overwhelm new users. Even power users like PKM expert Mike Schmitz identify only 8 plugins as "essential" despite running 39. Users report spending more time browsing plugins than writing notes.

**Update Fragility:**
Every Obsidian core update risks breaking plugins. Plugin-to-plugin conflicts also occur -- one plugin modifying link display can interfere with another tracking backlinks.

**COMPETITOR OPPORTUNITY:** A competitor could build the top 10 plugin capabilities as native features, eliminating the fragility, decision fatigue, and maintenance burden. The most-downloaded plugins reveal what users actually need built-in: drawing tools, templates, database queries, tasks, better tables, calendar view, and version history.

---

## 3. Common User Complaints and Pain Points

### Tier 1: Most Frequently Cited (Critical)

**3.1 Steep Learning Curve / "Tinkering Trap"**
- Users report spending more time perfecting their setup than actually taking notes
- Requires understanding Markdown, YAML frontmatter, plugins, templates, and linking conventions
- The customization rabbit hole is real: "I just know if I start I might spend a hundred hours tweaking it and never actually writing a thing"
- CSS snippets required for appearance customization beyond theme switching
- Community can be unwelcoming to newcomers ("RTFM energy")

**3.2 Poor Mobile Experience**
- 2026 Report Card: Mobile scored only 3/5 (personal) and 3.1/5 (community) -- the lowest category
- App loads the entire vault before allowing any interaction
- UI tries to replicate the desktop UI on a phone screen, resulting in awkward ergonomics
- Quick capture is painful: the full app must load before a note can be created
- Plugins add substantial load time on mobile
- iCloud sync on iOS causes additional lag (minutes of syncing on every launch)
- Android users report vaults taking over a minute to load (some report 5+ minutes)
- No "lazy loading" -- the entire vault is indexed on startup

**3.3 Sync is Expensive for What It Does**
- Obsidian Sync costs $4-8/month to sync plain markdown files
- Notion, Craft, and others include sync for free
- Free alternatives (iCloud, Dropbox, Git) all have significant problems:
  - iCloud: file corruption, duplication, stuck uploads (especially cross-platform)
  - Dropbox/OneDrive: conflict copies require manual merging
  - Git: requires technical knowledge, not viable for non-technical users
  - Syncthing: complex setup, potential sync delays

**3.4 No Real-Time Collaboration**
- No built-in way for multiple people to edit the same note simultaneously
- Third-party "Relay" plugin ($5-6/month) fills the gap but adds cost and complexity
- Teams end up emailing markdown files or using Git workarounds
- Long-standing feature request since September 2020, still not delivered

### Tier 2: Significant Issues

**3.5 Plugin Fragility**
- Critical plugins break with Obsidian updates
- Abandoned plugins (e.g., Note Companion AI / Fileorganizer2000) leave users stranded
- No compatibility verification system
- Users build workflows around plugins, then lose them

**3.6 Lack of Native AI / Automation**
- No built-in AI summarization, connection discovery, or content generation
- Users must use external tools (NotebookLM, etc.) breaking workflow
- Automation requires JavaScript knowledge or third-party tools (Actions for Obsidian)
- Copilot plugin (587K downloads in 2025) shows strong demand

**3.7 Electron / Memory Usage**
- Obsidian runs on Electron (Chromium wrapper)
- Reported memory usage: 774MB to 1GB+ for a single note in some cases
- Search performance degraded in Obsidian 1.9.10 / Electron 37
- Feels sluggish compared to native apps (Neovim, Bear, iA Writer)
- Not a dealbreaker for most users but a persistent criticism

**3.8 Search Is Inadequate**
- Core search has poor relevance ranking in large vaults
- Sometimes fails to find exact terms that exist in notes
- Only indexes Markdown files (not .txt, PDFs, etc.)
- Obsidian Publish has NO full-text search (headings/titles only)
- Community plugin Omnisearch (48K downloads/month) exists as a workaround
- No fuzzy matching, no semantic search in core

**3.9 Table Editing Is Painful**
- Editing a table in Live Preview reverts the entire table to raw markdown
- No cell-by-cell WYSIWYG editing
- Cannot set column widths, use lists inside cells, or merge cells
- Advanced Tables plugin helps but is "still far from comfort"
- Markdown table limitations are fundamental

### Tier 3: Notable Frustrations

**3.10 No Web Version**
- Feature request since June 2020, still undelivered as of March 2026
- Cannot access vault from a browser on a shared/work computer
- Obsidian Web Clipper exists but only clips content into the app

**3.11 Not Open Source**
- Source is available for inspection but license is proprietary
- FOSS-preference users see this as a negative (Logseq is fully open-source)

**3.12 Canvas Is Underdeveloped**
- 2026 Report Card: Canvas scored 3/5 (personal) and 3.5/5 (community)
- Lacks Kanban/Calendar views
- No Publish support for Canvas
- Long overdue for updates

**3.13 Onboarding Is Non-Existent**
- New users get a blank vault with no guidance
- Desktop onboarding experience lacks intuitiveness
- No interactive tutorial or progressive disclosure of features

---

## 4. Zettelkasten Implementation

### How Obsidian Handles It

Obsidian has been described as a tool that facilitates a "digital Zettelkasten" due to its linking features. The core mechanics are:

- `[[Wikilinks]]` for connecting notes
- Backlinks panel showing all notes that link to the current note
- Graph view for visualizing connections
- Tags for categorization
- Unique Note Creator core plugin for generating timestamp-based note IDs
- Templates (core + Templater plugin) for standardized note structures

### What Works

- Creating atomic notes and linking them is straightforward
- Backlinks provide the "surprise connections" that Zettelkasten promises
- Tags + links together provide flexible categorization
- The community has produced extensive Zettelkasten tutorials and templates

### What Does NOT Work

**No Hierarchical Note Relationships:**
In Luhmann's original Zettelkasten, notes have explicit parent-child relationships (5 -> 5a -> 5a1). Obsidian's links are flat -- there is no differentiation between a "child note" and any other linked note. The link `[[5a]]` in note `[[5]]` carries no semantic information about the relationship type.

**Timestamp IDs Are Uninformative:**
Using YYYYMMDDHHMMSS format (common in Obsidian Zettelkasten setups) gives zero information about how notes relate to each other. Luhmann's IDs (1, 1a, 1a1) were hierarchically meaningful. This is a fundamental limitation of Obsidian's flat linking model.

**Graph View Becomes Useless at Scale:**
Users cannot see their "train of thought" in the graph. With hundreds of notes, the graph becomes a chaotic ball of connected nodes with no discernible structure. Dedicated Zettelkasten tools like Zkn3 handle this better through their GUI.

**No Link Types:**
All links are the same. There is no way to indicate "this is a continuation" vs "this is a counterargument" vs "this is an example of." Some users work around this with tags in link text, but it is manual and fragile.

**Poor Mobile Quick Capture:**
The Zettelkasten method requires capturing fleeting thoughts quickly. Obsidian's mobile app is too slow for this. Power users maintain a two-app system (e.g., Bear or Apple Shortcuts for capture, Obsidian for processing).

**Block References Are Weak:**
Roam Research pioneered block-level referencing for Zettelkasten workflows. Obsidian has block references (`^block-id`) but they are not as fluid or natively integrated as in Roam or Logseq.

**COMPETITOR OPPORTUNITY:** A tool that provides first-class typed/hierarchical links, fast mobile capture, and meaningful note relationship semantics would address the most fundamental Zettelkasten pain points that Obsidian cannot solve with its current architecture.

---

## 5. Graph View

### How It Works

- Nodes represent files (typically markdown documents)
- Edges represent internal `[[wikilinks]]` between notes
- Available as a full-vault "Graph View" or a "Local Graph" showing connections for the current note
- Supports filtering by tags, folders, and search queries
- Nodes can be color-coded by group
- Physics-based layout (force-directed graph)
- Can be opened in a sidebar pane

### Limitations and Complaints

**Functionally Useless at Scale:**
"Even with a relatively small vault, the graph view quickly becomes a maelstrom of connected nodes that is difficult to read and lends little actual value." With hundreds of notes it is described as "practically useless."

**More "Visual Toy" Than Tool:**
Users attracted by the graph view's visual appeal in marketing materials find that it serves "more as a visual toy than a truly powerful organizational tool." It looks impressive but does not deliver actionable insight or help discover new connections.

**No Persistent Layout:**
The graph cannot save its arrangement. Every time you open it, the force-directed layout recalculates. This means any manual arrangement is lost. Users describe it as "practically unusable because the layout cannot be saved in place."

**No Parent-Child Differentiation:**
All nodes look the same. There is no visual distinction between hub notes, leaf notes, parent notes, or orphans beyond connection count affecting node size slightly.

**Performance Collapse with Large Vaults:**
A vault of 130,000 notes takes approximately 10 minutes to index the graph, even on a high-end system (Intel i7-14700KF, 64GB RAM, Nvidia 4090).

**No Semantic Grouping:**
The force-directed layout clusters by connection density, not by meaning. Related notes on different topics that happen to share links get pulled together, while meaningfully related notes with fewer links drift apart.

**Plugin Alternatives Are Inadequate:**
Community alternatives like Juggl are described as buggy. Users have requested features like preventing node title overlap, scaling nodes by child count, and matching text color to node color -- none of which are available natively.

**Publish Graph Is Worse:**
Obsidian Publish sites show a graph view that users "can't seem to adjust at all" -- everything clumps in a circle with no customization.

**COMPETITOR OPPORTUNITY:** A graph view that is actually useful would need: persistent/savable layouts, semantic clustering, hierarchical visualization, performant rendering at scale (WebGL/GPU-accelerated), and the ability to interact meaningfully with the graph (drag to reorganize, create links by drawing edges, filter dynamically). This is one of the most over-promised and under-delivered features in the entire PKM space.

---

## 6. Sync Mechanism

### Obsidian Sync (Official)

- End-to-end encrypted
- $4/month (Standard, 1GB) or $8/month (Professional, 10GB) billed annually
- Syncs across all platforms (desktop, mobile)
- Version history included
- Selective sync (choose which folders)
- 2026 Report Card: 4.6/5 community rating ("rock solid reliable")
- As of February 2026, vaults can sync without running the full app

### Free Alternatives and Their Problems

| Method | Platforms | Key Problems |
|--------|-----------|--------------|
| iCloud | Apple-only (buggy on Windows) | File corruption, duplication, stuck uploads, unreliable cross-platform |
| Dropbox | All | Conflict copies require manual merging, no native conflict resolution |
| OneDrive | All | Same conflict-copy issues as Dropbox |
| Google Drive | All (via FolderSync on Android) | Complex setup, sync delays, no iOS support |
| Git (obsidian-git plugin) | All | Requires technical knowledge, merge conflicts, not for non-technical users |
| Syncthing | All | Complex setup, peer-to-peer requires both devices online |
| Remotely Save plugin | All (via S3, WebDAV, etc.) | PRO required for smart conflict handling, setup complexity |

### Core Sync Pain Points

1. **Price perception**: $4-8/month feels expensive for syncing text files when Notion/Craft include sync free
2. **No free tier for multi-device**: Obsidian is free on a single device but sync across devices requires payment or DIY
3. **iCloud is the default iOS solution but is unreliable**: Most iOS users want "it just works" sync and iCloud does not deliver
4. **Settings/plugin sync is separate from note sync**: Plugin configurations, themes, and hotkeys require separate sync consideration
5. **Conflict resolution in free alternatives is manual and error-prone**

**COMPETITOR OPPORTUNITY:** Free, reliable, cross-device sync is table-stakes for a modern note app. Building sync into the core product (even with storage limits on a free tier) would immediately address one of Obsidian's biggest friction points. End-to-end encryption should be standard, not premium.

---

## 7. Mobile / Web Experience

### Mobile App (iOS and Android)

**Current State (March 2026):**
- Available on both iOS and Android
- Uses the same Electron/WebView-based rendering as desktop
- 2026 Report Card: 3/5 personal, 3.1/5 community (lowest rated category)
- Improvement noted from 2025 to 2026 but "still has a ways to go"

**Specific Problems:**
1. **Startup time**: Full vault loads before any interaction is possible. Large vaults: 1-5+ minutes. Even small vaults with many plugins: several seconds.
2. **No lazy loading**: The entire vault is indexed on startup rather than loading on-demand
3. **UI is a shrunken desktop**: Not redesigned for mobile interaction patterns; feels "awkward on a smartphone"
4. **Quick capture is broken**: The most common mobile use case (jot a quick thought) requires waiting for the full app to load
5. **Plugin compatibility**: Many plugins don't work or work poorly on mobile
6. **Table editing on mobile**: Advanced Tables' Tab/Enter navigation doesn't work; requires manually adding toolbar commands
7. **iOS iCloud sync lag**: Syncing on every launch, sometimes appearing to hang completely
8. **Android performance**: Even on modern devices with small vaults, the app can be "extremely slow to launch"

### Web Version

**Current State: Does NOT exist.**

- Feature request open since June 2020
- One of the most requested community features
- Obsidian has invested instead in:
  - Desktop and mobile native apps
  - Web Clipper browser extension (clip content into Obsidian)
  - Web Viewer core plugin (browse the web from inside Obsidian)
- No official web app announced or on the public roadmap

**Why Users Want It:**
- Access vault from work/shared computers without installing software
- Quick access from any device with a browser
- Chromebook users have no option
- Some corporate environments restrict app installation

**COMPETITOR OPPORTUNITY:** A performant web app that loads instantly, supports quick capture, and provides a mobile-optimized UI (not a shrunken desktop) would address Obsidian's weakest category. The web-first approach also eliminates the Electron memory overhead on desktop. Progressive web app (PWA) architecture could provide offline capability while maintaining the "works everywhere" advantage.

---

## 8. Window Management

### How Tabs/Panes Work

- Obsidian supports tabs (multiple notes in one pane, like browser tabs)
- Split view: horizontal and vertical splits to view multiple notes simultaneously
- Pop-out windows: notes can be popped into separate OS windows
- Sidebar panels: file explorer, search, backlinks, outline, tags in left/right sidebars
- Stacked tabs mode: tabs arranged in a stack rather than a tab bar

### What Is Missing / Broken

**Unintuitive Tab Behavior:**
- Tab history "jumps between panes unpredictably"
- Navigation uses a "confusing global history that jumps between panes randomly" instead of per-tab history
- Clicking a link in one pane may open in an unexpected pane

**Split View Limitations:**
- Opening a second pane is easy, but managing multiple tabs across different panes becomes "a nightmare"
- Users want to click a link in pane A and have it open in pane B -- this doesn't work intuitively
- "Cramped vertical splits" make multi-document research sessions difficult
- Deleting a file closes the tab in split view (reported bug, 2025)

**Pop-Out Window Limitations:**
- Pop-out windows cannot have their own sidebars (file explorer, outline, backlinks)
- Only the main window gets sidebar features
- Cannot split a window (only panes within the main window)

**No Per-Pane History:**
- Navigation history is not tracked per-tab/per-pane
- Going back/forward jumps across panes unpredictably
- The Pane Relief plugin fixes this but it should be a core feature

**Plugin Workarounds:**
- Pane Relief: per-pane history, browser-style close, keyboard shortcuts
- Obsidian Tabs: tabbed pane management
- Split Pane View: hotkeys for quick split creation

**COMPETITOR OPPORTUNITY:** Proper window management with per-tab history, intuitive split-pane link following, detachable windows with full sidebar support, and saved workspace layouts would serve power users who do research and writing across multiple notes simultaneously. This is an area where IDE-like polish (VS Code's approach) would resonate strongly.

---

## 9. Summary of Competitor Opportunities

### Critical Gaps a Competitor Could Address

| Gap | Severity | Obsidian's Approach | Opportunity |
|-----|----------|--------------------|----|
| Mobile quick capture | Critical | Full app load required | Instant capture with background sync |
| Free cross-device sync | Critical | $4-8/month or DIY | Free tier with E2E encryption |
| Real-time collaboration | Critical | Not supported (plugin only) | Native multiplayer editing |
| Onboarding / learning curve | High | Blank vault, figure it out | Guided setup, progressive disclosure |
| Web access | High | No web version | Browser-based app (PWA) |
| AI integration | High | Third-party plugins only | Native AI summarization, linking, search |
| Graph view that works | High | "Visual toy" | GPU-accelerated, semantic, persistent layouts |
| Table editing | Medium | Raw markdown fallback | Cell-by-cell WYSIWYG |
| Plugin stability | Medium | No compatibility system | Core features instead of plugins |
| Search quality | Medium | Poor relevance, no fuzzy | Full-text, semantic, fuzzy search |
| Typed/hierarchical links | Medium | All links are flat | Link types, parent-child relationships |
| Window management | Medium | Unpredictable history | Per-tab history, smart split behavior |

### What NOT to Compete On (Obsidian's Strengths)

These areas are where Obsidian is strong and a head-on competition would be difficult:

1. **Plugin ecosystem scale** -- 2,500+ plugins is an enormous moat
2. **Community size and passion** -- one of the most active PKM communities
3. **Desktop performance** -- 4.5/5, handles 50K+ files well (despite Electron criticism)
4. **Sync reliability** (for paying customers) -- 4.6/5, "rock solid"
5. **Data ownership / local-first philosophy** -- deeply resonates with the target audience
6. **Free personal use** -- hard to undercut free
7. **Markdown compatibility** -- universal format, no lock-in

### Strategic Positioning Recommendations

**For a new competitor, the highest-impact positioning would be:**

1. **"Obsidian's power without the setup"** -- same local-first, markdown-based philosophy but with better defaults, guided onboarding, and core features that eliminate plugin dependency
2. **"Mobile-first knowledge management"** -- fast capture, instant loading, native mobile UI (not a shrunken desktop)
3. **"Collaborative by default"** -- real-time multiplayer editing built into the core product
4. **"AI-native PKM"** -- semantic search, automatic link suggestions, AI summarization as core features
5. **"Works everywhere"** -- web app + desktop + mobile with free sync

---

## Sources

- [Obsidian Official Site](https://obsidian.md/)
- [Obsidian Developer Documentation](https://docs.obsidian.md/)
- [Obsidian Plugin API (GitHub)](https://github.com/obsidianmd/obsidian-api)
- [ObsidianStats - Most Downloaded Plugins](https://www.obsidianstats.com/most-downloaded)
- [Obsidian Plugins Wrapped 2025](https://www.obsidianstats.com/posts/2025-12-04-wrapped-2025)
- [The 2026 Obsidian Report Card](https://practicalpkm.com/2026-obsidian-report-card/)
- [Obsidian Review: What Nobody Tells You (2026)](https://thebusinessdive.com/obsidian-review)
- [Obsidian is really starting to fall behind alternatives (XDA)](https://www.xda-developers.com/obsidian-is-starting-to-fall-behind-alternatives/)
- [Obsidian's reliance on plugins (XDA)](https://www.xda-developers.com/obsidians-reliance-on-plugins/)
- [10 Problems with Obsidian (Medium)](https://medium.com/@theo-james/10-problems-with-obsidian-youll-realize-when-it-s-too-late-17e903886847)
- [Obsidian: the Good, the Bad, & the Ugly](https://www.originalmacguy.com/obsidian-the-good-the-bad-the-ugly/)
- [Problems, positives and negatives of Obsidian (Forum)](https://forum.obsidian.md/t/problems-positives-and-negatives-of-obsidian/90481)
- [Why does Obsidian lead to a confusing Zettelkasten?](https://forum.zettelkasten.de/discussion/1745/why-does-obsidian-lead-to-a-confusing-zettelkasten)
- [Obsidian Graph view doesn't work for a large Vault (Forum)](https://forum.obsidian.md/t/obsidian-graph-view-doesnt-work-for-a-large-vault/106287)
- [Obsidian for web - Feature Request (Forum)](https://forum.obsidian.md/t/obsidian-for-web/2049)
- [Obsidian Sync: Live team collaborative editing (Forum)](https://forum.obsidian.md/t/obsidian-sync-live-team-collaborative-editing/6058)
- [Relay - Team collaboration in Obsidian](https://relay.md/)
- [iOS App extremely slow to load (Forum)](https://forum.obsidian.md/t/ios-app-extremely-slow-to-load/67031)
- [Obsidian is loading very slow on Android (Forum)](https://forum.obsidian.md/t/obsidian-is-loading-very-slow-on-android/85228)
- [Request to speed up mobile app startup (Forum)](https://forum.obsidian.md/t/request-to-speed-up-the-startup-speed-of-the-mobile-app/91272)
- [Live Preview: Support editing a table cell by cell (Forum)](https://forum.obsidian.md/t/live-preview-support-editing-a-table-cell-by-cell/34110)
- [Curating out-of-date plugins (Forum)](https://forum.obsidian.md/t/curating-out-of-date-plugins/34569)
- [Omnisearch plugin solves search struggles (XDA)](https://www.xda-developers.com/ways-omnisearch-obsidian-plugin-solved-my-biggest-search-struggles/)
- [Obsidian as AI Infrastructure](https://blakecrosley.com/guides/obsidian)
- [Obsidian Roadmap](https://obsidian.md/roadmap/)
- [Bases Introduction (Obsidian Help)](https://help.obsidian.md/bases)
- [Bases Roadmap](https://help.obsidian.md/bases/roadmap)
- [Best Obsidian Plugins for 2026](https://www.dsebastien.net/the-must-have-obsidian-plugins-for-2026/)
- [Top Obsidian Plugins 2026 (Obsibrain)](https://www.obsibrain.com/blog/top-obsidian-plugins-in-2026-the-essential-list-for-power-users)
- [Obsidian Wikipedia](https://en.wikipedia.org/wiki/Obsidian_(software))
- [Obsidian Sync: Complete Guide and Alternatives](https://notionist.app/alternative-to-obsidian-sync)
- [Pane Relief Plugin (GitHub)](https://github.com/pjeby/pane-relief)
- [How to limit split view (Forum)](https://forum.obsidian.md/t/how-to-limit-split-view-to-just-2-panes-and-open-new-tabs-in-those-panes/61526)
- [Obsidian Electron performance (Hacker News)](https://news.ycombinator.com/item?id=36616563)- [Search performance degradation in Obsidian 1.9.10 (Forum)](https://forum.obsidian.md/t/performance-degradation-in-1-9-10-installer-electron-37/104418)
