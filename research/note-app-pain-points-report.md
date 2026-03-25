# Research Report: Pain Points & Feature Requests in Note-Taking Apps (2024-2026)

**Date**: 2026-03-24
**Research Depth**: Deep Dive
**Apps Covered**: Obsidian, Notion, Logseq, AFFiNE, Notesnook
**Sources Consulted**: 40+ across Reddit, Hacker News, GitHub, Obsidian Forum, Logseq Forum, review sites, and developer blogs

---

## Executive Summary

After surveying discussions across Reddit, Hacker News, GitHub issues, the Obsidian Forum, Logseq Forum, and independent review sites from 2024-2026, ten major pain point categories emerged. The note-taking app space is characterized by a fundamental tension: **no single app does collaboration, performance, privacy, and extensibility well simultaneously.** Users are forced to choose between Notion's collaboration (at the cost of privacy and performance), Obsidian's speed and extensibility (at the cost of collaboration and enterprise features), or open-source alternatives that promise both but deliver neither reliably.

The most significant unmet needs are: (1) real-time collaboration that works in a local-first architecture, (2) search that understands semantics rather than just keywords, (3) enterprise auth (SSO/SCIM) without exorbitant pricing, (4) plugin ecosystems with stable APIs and proper documentation, and (5) public publishing with granular selective sharing built into the core experience.

---

## Table of Contents

1. [Most Requested Features No App Has Implemented Well](#1-most-requested-features-no-app-has-implemented-well)
2. [Common Frustrations with Existing Apps](#2-common-frustrations-with-existing-apps)
3. [Enterprise/Team Use Cases Poorly Served](#3-enterpriseteam-use-cases-poorly-served)
4. [Self-Hosting Pain Points](#4-self-hosting-pain-points)
5. [Plugin Ecosystem Complaints](#5-plugin-ecosystem-complaints)
6. [Real-Time Collaboration Gaps](#6-real-time-collaboration-gaps)
7. [Public Publishing Problems](#7-public-publishing-problems)
8. [Performance Issues](#8-performance-issues)
9. [Search Quality](#9-search-quality)
10. [SAML/SSO Integration](#10-samlsso-integration)

---

## 1. Most Requested Features No App Has Implemented Well

### Local-First + Real-Time Collaboration

The single most requested combination across all communities. Users want Obsidian's local-first data ownership with Notion's multiplayer editing. No app delivers both reliably.

> "Obsidian is celebrated for privacy, customization, and networked thought, while Notion wins for collaboration, structure, and ease of use." -- Recurring sentiment across r/ObsidianMD and r/Notion

**Current state**: Obsidian's Relay plugin offers CRDT-based collaboration, but it is a third-party plugin, not a core feature. Notion launched offline mode in August 2025, but sync conflicts can silently overwrite work, and databases are capped at 50 rows offline.

### Block-Level Referencing in Page-Based Apps

Obsidian's page-centric model means linking to a concept creates an empty page, whereas Logseq auto-populates linked and unlinked block references. Users want this cross-referencing without Logseq's stability issues.

> "It's a shame it doesn't offer the option of going block based with automatic cross-referencing, which really makes organization completely unnecessary." -- Obsidian Forum comparison discussion

### Native Task Management

Obsidian requires plugins (like Dataview or Tasks) for basic task management. These are fragile and lack the polish of dedicated tools. No note-taking app bridges the gap between capturing thoughts and managing tasks effectively.

### Semantic / AI-Powered Search as a Core Feature

Users want to type natural language queries like "What did we decide about the budget last quarter?" and get relevant results. Mem AI's Deep Search does this, but it is a standalone product. The major note-taking apps either lack semantic search entirely or gate it behind expensive AI add-ons.

### Reliable Cross-Platform Sync Without Vendor Lock-in

Users want sync that "just works" across all devices, with conflict resolution, without requiring a proprietary service. Currently: Obsidian Sync works but costs $4-5/month; Logseq sync via Syncthing is "disastrous" with "significant data loss or file corruption more than half the time"; Notion requires internet connectivity.

---

## 2. Common Frustrations with Existing Apps

### Obsidian

| Frustration | Details |
|---|---|
| **Plugin dependency** | "Plugins are what make Obsidian powerful, but they shouldn't have to carry the entire app. Relying on them creates gaps, forces users to experiment, and risks breakage when developers move on or updates cause conflicts." |
| **Complexity/learning curve** | Users call it "too complex for normal people." Setup requires learning Markdown, choosing plugins, configuring templates, and building a linking system. |
| **Over-engineering trap** | "I found myself working on my workflow, not doing real work." Users spend hours configuring instead of creating. |
| **UI feels dated** | "The front end of Obsidian needs some development, and the UI seems old-fashioned." |
| **Mobile experience** | Mobile app is slow, especially with large vaults. Loading can take 5-10 minutes with 40,000+ notes. |
| **No collaboration** | "Obsidian can only be used for personal knowledge management." |

### Notion

| Frustration | Details |
|---|---|
| **Cloud dependency / outages** | Went fully down in Feb 2023 and Feb 2024. "None of the notes they were working on was saved -- not even a temp cache document. It was just gone." |
| **Performance at scale** | Electron app uses 400-600 MB RAM, spikes above 800 MB with complex databases. "Database fatigue" with large workspaces. |
| **Expensive AI add-on** | Notion AI costs $8/month per member on top of base subscription. Now bundled into Business plan at $20/user/month, forcing users to pay for features they may not need. |
| **Vendor lock-in** | "No Markdown. No local files." Data lives on Notion's servers with limited export capabilities. |
| **Pricing changes erode trust** | Changed prices in mid-2024 and May 2025, pushing users to higher tiers. "Removing members mid-cycle gets you nothing back." |
| **Offline mode limitations** | Released Aug 2025 but databases capped at 50 rows offline, non-text properties do not merge, mobile only syncs on Wi-Fi. |

### Logseq

| Frustration | Details |
|---|---|
| **Stalled development** | Last stable release was April 2024. "On platforms like Reddit, some users have even questioned whether the project is alive." |
| **DB version delays** | Started planning in 2022, still not released. "Holding out hope for the DB version is a fool's errand for the foreseeable future." |
| **Sync data loss** | Syncthing users report "significant data loss or file corruption more than half the time." "Cloud sync + Git = guaranteed merge hell." |
| **Complexity creep** | "Logseq is increasingly catering to power users" with "a degree of rigidity and complexity that feels at odds with what outliners should provide -- simplicity." |
| **Import/migration failures** | DB version conversion results in "tags being lost, properties/values not being smartly converted." |

### AFFiNE

| Frustration | Details |
|---|---|
| **Stability** | "Quite rough around the edges with frequent bugs and crashes." Some users lost all early test data. |
| **AI is unreliable** | "When you select text and use 'Improve with AI,' you'll likely get back content that's mostly unrelated to your text." |
| **CPU usage** | "CPU usage can still get high sometimes, especially with larger workspaces." |
| **UI readability** | "The text in the app is too tiny and small, causing eye strain." |

### Notesnook

| Frustration | Details |
|---|---|
| **Slow image loading** | "Slow image loading was a constant complaint from a lot of users (especially on Reddit)." |
| **Feature gating** | "Some block insert options are reserved for the paid tiers." |
| **Less feature-rich** | Lightweight but cannot compete with Notion or Obsidian on power features. |

---

## 3. Enterprise/Team Use Cases Poorly Served

### The Knowledge Base Maintenance Problem

> "Because of no verification, you have to put blind trust in a wiki's information or double check its accuracy. When referring to a company wiki, it'd be frustrating to search for product feature details and only get a 3-month-old doc as a search result. Because of this, most company wikis suck."

**Core issues for teams:**

- **Content rot**: No built-in mechanism for content verification or freshness. Documents go stale silently.
- **Ownership gap**: Wikis lack clear document ownership. "No one's responsible for maintaining a wiki."
- **Notion's permission model is incomplete**: Row-level permissions arrived as a long-awaited feature, but there is still no column-level security. "If a user can see a page, they can see all of its properties."
- **Guest management headaches**: In Notion, "guests are automatically turned into members" if the workspace exceeds the guest limit, unexpectedly increasing costs.
- **Custom permissions require Enterprise**: Notion's granular permission controls are only available on Enterprise plans ($18-25/user estimated).

### What Teams Actually Need But Cannot Get

1. **Granular permissions without Enterprise pricing** -- Most teams under 50 people cannot justify $20+/user/month.
2. **Content freshness indicators** -- Automated staleness detection and owner notification.
3. **Hybrid personal + shared knowledge** -- Keep personal notes private while contributing to shared team spaces, with clear boundaries.
4. **Cross-team discoverability** -- Finding relevant knowledge created by other teams without "information silos."
5. **Audit trails at reasonable price points** -- Currently gated behind Enterprise tiers in most apps.

---

## 4. Self-Hosting Pain Points

### Sync Conflicts Are the #1 Problem

Multi-device sync remains the primary frustration for self-hosted note-taking setups.

> "The problem isn't data ownership -- it's the friction that comes with synchronizing from multiple sources."

**Specific failure modes:**
- Syncthing with Logseq: "disastrous" with "significant data loss or file corruption more than half the time"
- iCloud with Obsidian: Files created via iCloud not immediately visible in Obsidian Sync
- Git-based sync: Works for technical teams but "constant merge conflicts" for normal usage patterns

### Technical Setup Barriers

- Docker/Node.js deployment required for tools like SilverBullet
- Backup configuration and security maintenance create ongoing overhead
- Many self-hosted apps lack mobile apps entirely

### Maintenance Fatigue

> "Over the years, the maintenance wasn't sustainable -- some things are better maintained by people whose job it is to maintain them."

Users report stopping self-hosting of note apps specifically because:
- Constant updates and compatibility checks
- Security patching responsibility
- Backup verification burden
- No help when things break

### Single-User Design

Most self-hosted note apps are designed for individual use. Family or team sharing requires workarounds. Built-in encryption is often missing (e.g., SilverBullet allows collaboration through shared server access but has no built-in encryption).

### The Privacy-Convenience Tradeoff

> "Many popular note-taking apps ask for too much in return, which includes accounts, cloud sync, and trust in someone else's servers. Yet local apps often lack collaboration features, require manual syncing across devices, and may have a learning curve for advanced features."

---

## 5. Plugin Ecosystem Complaints

### Obsidian Plugin Developer Pain Points

**5.1 Slow and Frustrating Review Process**

> "After submitting my plugin, it took almost a month for somebody to respond to it."

Feedback was described as "poorly formatted," "difficult to read," and "terse and without explanation." Reviewers made "opinionated" code change requests treated as mandatory, without engaging in discussion. Multiple developers have asked on the forum whether weeks-long waits are normal.

The Obsidian team acknowledged this backlog, attributing it partly to the rise of "vibe-coding" (AI-generated plugin submissions) overwhelming the manual review process.

**5.2 Sparse and Incomplete API Documentation**

> "I saw several people saying that developer docs are great, however, other than the example plugin and related guides, the API reference is quite sparse in explanations."

Specific complaints:
- Methods like `app.vault.modify` do not describe what they do -- only listing parameters
- TypeScript interface "lacks documentation comments for most of the methods and properties it defines"
- Developers must reverse-engineer behavior from source code
- Community-created unofficial docs were eventually incorporated into official docs, but gaps remain
- All GitHub issues were removed from the obsidian-api repository without migration

**5.3 Undocumented/Internal API Reliance**

Community projects like `obsidian-typings` and `obsidian-extra` exist because the official API is insufficient. These provide type-safe access to internal APIs but come with warnings: "typings are based on reverse engineering and may be inaccurate or unstable. They can change without notice."

**5.4 Plugin Abandonment Creates Ecosystem Fragility**

> "If a developer stops updating a plugin, users are left with the last working version, and eventually minor glitches start to appear."

Concrete example: The popular "Projects" plugin by Marcus Olsson was discontinued as of May 2025 despite having "huge potential to turn Obsidian into a full blown project management suite."

**5.5 User-Side Plugin Fatigue**

> "What started as an empowering playground turned into an exhausting maintenance job -- with sync issues, daily note management becoming a chore, and spending more time battling plugins than creating."

Plugin conflicts compound problems: "when one plugin interferes with another, both stop behaving the way they should."

### Logseq Plugin Ecosystem

- Far smaller ecosystem (~150 plugins vs Obsidian's 2,000+)
- Uncertainty about whether existing plugins will work with the new DB version
- Development effectively paused during the architecture rewrite

---

## 6. Real-Time Collaboration Gaps

### What Users Want

1. Live multiplayer editing (like Google Docs) in a local-first app
2. Cursor presence and awareness of who is editing what
3. Conflict-free merging when working offline then reconnecting
4. Comments, @mentions, and inline discussion
5. Permission controls (viewer, editor, admin)

### What Exists Today

| App | Collaboration Status |
|---|---|
| **Notion** | Best-in-class real-time collab, but cloud-dependent with outage risks |
| **Obsidian** | No native collaboration. Relay plugin (3rd-party) adds CRDT-based live editing. Peerdraft adds E2E encrypted sessions. |
| **Logseq** | No real-time collaboration. Planned alongside DB version but not delivered. |
| **AFFiNE** | Basic collaboration exists but stability is poor |
| **Notesnook** | No collaboration features |

### Technical Challenges with CRDTs

CRDTs (Conflict-free Replicated Data Types) are the standard approach for local-first collaboration, but they have significant limitations:

- **Rich text intent loss**: "Working at such a low level provides an easier guarantee of eventual consistency, but you lose sight of the big picture." Operations like "split text node" are well-understood in OT but become clinical in CRDT.
- **Library lock-in**: CRDT libraries "present as a networked black box that inputs operations and outputs state. This monolithic, unmodifiable approach becomes a liability when your app requires features that the library author did not anticipate."
- **Beyond text is hard**: Collaboration on structured data (databases, kanban boards, properties) is far more complex than text collaboration.
- **Infrastructure burden**: Even with Yjs, developers must build their own presence indicators, permission systems, and real-time infrastructure.

### The Collaboration Gap

> A developer who built a custom CRDT-based note app spent months "digging around the dark corners of the engine, adding new minor features, or fixing obscure (terrifying) bugs" before shelving the project, concluding they "would more than likely just use Yjs."

The fundamental unsolved problem: **No one has built a production-quality, local-first, real-time collaborative note-taking experience that matches Google Docs' smoothness while maintaining data sovereignty.**

---

## 7. Public Publishing Problems

### Obsidian Publish: Works But Expensive

- $8/month annually ($10/month otherwise) per site
- Selective publishing works well (choose which notes to publish)
- Supports custom domains, themes, password protection
- But: "As a student, many can't afford the $8/month"
- Graph view and backlinks render on published sites
- No native commenting or reader interaction

### Free Alternatives Are Technically Demanding

- **Digital Garden Plugin**: Free, uses `dg-publish: true` frontmatter flag per note. But requires Git knowledge and web hosting setup. Managing publish status is tedious -- "it was easy to forget which notes had already been published."
- **Pubsidian**: Free GitHub-hosted alternative, but less polished
- **Static site generators** (Hugo, Quartz, etc.): Powerful but require significant technical setup

### Notion Public Pages: Simple But Limited

- Toggle a page to public with one click
- But: Exposes contributor names, profile photos, and email addresses
- No selective property hiding -- "If a user can see a page, they can see all of its properties"
- Public pages with "Can Edit" permissions create security risks
- No custom domains on free/Plus plans

### What Users Actually Want

1. **One-click selective publishing** without paying $8/month
2. **Granular control** over which sections/blocks within a note are public vs. private
3. **Reader interaction** -- comments, reactions, or feedback on published notes
4. **Custom domains** without premium pricing
5. **SEO-friendly output** with proper meta tags, Open Graph, etc.
6. **Progressive publishing** -- share drafts with specific people, then publish broadly
7. **Bidirectional links that work in published view** -- graph navigation for readers
8. **Analytics** -- know which published notes are being read

### The Core Complaint

> "I'm exhausted by the note-taking app hype cycle. Every year, some new contender promises to 'reimagine how we think,' then delivers another markdown editor with a gimmick."

Publishing from a note-taking app should be as simple as toggling a switch, with full control over visibility, appearance, and domain -- but every solution is either expensive, technically complex, or both.

---

## 8. Performance Issues

### Obsidian Performance Problems

**Desktop (Large Vaults):**
- Vault with 2,700 markdown files + 570,000 total files: "Both initial load and anything involving searching were unusably slow." Non-markdown attachment counts cause severe slowdowns that typical "large vault" optimizations do not address.
- One user reported "Loading Workspace" lasting ~5 minutes on Windows 10 (Obsidian v1.5.12, May 2024).
- Mac users report core plugins (not just third-party) causing slow load times.

**Mobile:**
- A vault of 40,000+ notes on iPhone 14 Pro with Obsidian Sync: "major performance issues" (March 2025)
- Mobile loading: "around 5 minutes to load plugins and around 10 minutes for loading workspace" even in restricted mode
- Obsidian shipped v1.7.3 in Feb 2026 with 30% search speed improvement for large vaults, but mobile remains problematic

**RAM Usage:** 180-250 MB for large vaults (significantly lighter than Notion)

### Notion Performance Problems

**RAM Consumption:** 400-600 MB baseline, spikes above 800 MB with complex databases. On 8 GB machines alongside VS Code and Slack, this is painful.

**Cloud Latency:**
> One HN commenter noted they never felt Notion was "slow" until they moved to Obsidian. "Now when I have to use Notion at work, it feels sluggish."

**Outage Impact:** Cloud dependency means any connectivity issues directly impact usability. Notable multi-day outages in Feb 2023 and Feb 2024 with data loss.

**"Database Fatigue":** Complex page hierarchies and large datasets cause noticeable performance degradation.

### Logseq Performance

- Generally acceptable for small-to-medium graphs
- Mobile app described as "buggy"
- The pending DB version is supposed to improve performance but remains unreleased

### AFFiNE Performance

- "CPU usage can still get high sometimes, especially with larger workspaces"
- "Frequent bugs and crashes" in early versions (improving but not resolved)

### Key Performance Insight

The core tension: **local-first apps (Obsidian) are fast until vaults get very large or you use mobile; cloud apps (Notion) have consistent latency and outage risk regardless of vault size.**

---

## 9. Search Quality

### Obsidian Search: Fundamentally Flawed for Most Users

**Phrase search does not work intuitively:**
> Searching for "infectious disease" finds files containing both words separately and in any order, rather than the exact phrase. A frequently-used page with that exact title may not even surface.

**Requires arcane syntax:**
> "Search should be as close as to googling as possible." Instead, users must learn regex, quotes for exact phrases, and special operators.

**Fuzzy search degrades at scale:**
> In a test, typing `[[nutwo` correctly suggests "Number Two" in a new vault. After copying in 2,656 files, the same query returns "No match found."

**Random file exclusion:**
> "Search results only cover some files but not all, and the files that are not searched seem to be random."

**Performance regressions:**
> After updating from 1.8.10 to 1.9.10, users noticed "a big degradation of the performance of the search feature."

**A deep complaint from the forum:**
> "The search function needs to be rewritten and re-thinked." -- Obsidian Forum user (Aug 2024)

**Common workaround:** Install the Omnisearch community plugin, which provides a more intuitive search experience. But this again reinforces the "plugins carry the app" problem.

### Notion Search

- AI-powered search uses NLP but is gated behind paid AI add-on
- Cloud-dependent (search does not work offline or in poor connectivity)
- Large workspaces report slow and inconsistent search results
- No local indexing means every search hits the network

### What Users Want From Search

1. **Semantic search**: Find notes by meaning, not just keywords
2. **Instant results**: No loading spinners, no network dependency
3. **Fuzzy matching that scales**: Works with 10 notes or 100,000
4. **Natural language queries**: "What did I write about X last month?"
5. **Search across note content, properties, tags, and filenames** simultaneously
6. **Highlighted context** showing where matches appear
7. **Ranked relevance** rather than chronological or alphabetical dumps

---

## 10. SAML/SSO Integration

### The "SSO Tax" in Note-Taking Apps

SSO and SCIM are standard requirements for enterprise IT, but note-taking apps gate them behind their most expensive tiers.

| App | SSO Available? | Minimum Plan | Price |
|---|---|---|---|
| **Notion** | Yes (SAML) | Business | $20/user/month |
| **Obsidian** | No | N/A | N/A |
| **Logseq** | No | N/A | N/A |
| **AFFiNE** | No (self-host only) | N/A | N/A |
| **Notesnook** | No | N/A | N/A |

### Notion's Enterprise Auth: Good But Expensive

**What works:**
- SAML SSO available on Business ($20/user) and Enterprise (custom)
- SCIM user provisioning (Enterprise only)
- Supports Okta, Azure AD / Microsoft Entra ID, and other major IdPs
- SP and IDP initiated SSO
- Just-In-Time provisioning

**What does not work well:**
- **SCIM requires Enterprise** -- Business tier has no automated user provisioning, meaning manual user management for teams that only need SSO + provisioning
- **Enterprise pricing is opaque** -- Custom pricing "creates budget uncertainty" with "procurement cycles adding 6-8 weeks of lead time"
- **No SSO bypass granularity** -- "Workspace owners will always have the option to bypass SAML SSO by using their email and password credentials"
- **Guest exclusion** -- "Guests are not supported with SAML SSO"
- **Forced bundling** -- "You're basically forced to buy a bundle of features just to get the one you really want"

### Obsidian: Zero Enterprise Auth

Obsidian has no SAML SSO, no SCIM, no audit logs, no centralized admin controls. Teams using Obsidian rely on Git-based workflows, which "work well for technical teams but are impractical for non-technical users."

For organizations that need enterprise auth, Obsidian is simply not an option. The local-first model is easier for compliance in some regulated industries (healthcare, government), but offers no centralized identity management.

### The Gap

> "The gap widens further at enterprise scale, where Notion offers dedicated support, SAML SSO, and compliance features that Obsidian simply does not provide."

**What enterprise teams actually need:**
1. SAML SSO at a reasonable price point (not $20/user/month)
2. SCIM provisioning without requiring custom Enterprise quotes
3. Audit logs accessible on mid-tier plans
4. SSO that works for both internal members and external guests/contractors
5. Self-hosted deployment with IdP integration for regulated industries
6. Group-based permissions synced from the IdP

---

## Cross-Cutting Themes

### Theme 1: The Impossible Tradeoff Triangle

Every note-taking app forces users to choose two of three:
- **Privacy/Data Ownership** (local-first, offline, your files)
- **Collaboration** (real-time editing, sharing, permissions)
- **Simplicity** (low learning curve, works out of the box)

No app in 2026 delivers all three. Obsidian excels at privacy but lacks collaboration and simplicity. Notion excels at collaboration and (debatable) simplicity but lacks privacy. Logseq promised all three and is stuck in a multi-year rewrite.

### Theme 2: Plugin Ecosystems Are a Liability

Obsidian's 2,000+ plugins are simultaneously its greatest strength and weakness. When plugins work, Obsidian can do almost anything. When they break, abandon, or conflict, users are left scrambling with no recourse. The API documentation is sparse, the review process is slow, and there is no safety net when plugins die.

### Theme 3: Enterprise Is an Afterthought

Note-taking apps were built for individuals and retrofitted for teams. Notion has come closest to enterprise viability but gates critical features behind expensive plans. Every other app in this study lacks basic enterprise requirements (SSO, SCIM, audit logs, granular permissions).

### Theme 4: Search Is a Decade Behind

In 2026, users expect Google-quality search with semantic understanding. Note-taking apps deliver keyword matching with unintuitive syntax. The gap between user expectations and reality is enormous.

### Theme 5: Sync Is Still Unsolved

Despite years of effort, no one has made multi-device sync "just work" for local-first apps. Obsidian Sync is the closest, but it costs money and does not enable real-time collaboration. Self-hosted sync solutions (Syncthing, Git, iCloud) all have documented failure modes including data loss.

---

## Recommendations for a New Entrant

Based on this research, the highest-impact opportunities for a new note-taking app are:

1. **Local-first with built-in real-time collaboration**: Use CRDTs but invest heavily in the UX layer (presence, permissions, comments) that CRDT libraries do not provide. This is the #1 unmet need.

2. **Semantic search from day one**: Embed local vector search that works offline. Let users search by meaning, not just keywords. This alone would differentiate from every competitor.

3. **SSO/SCIM at mid-tier pricing**: Offer SAML SSO and SCIM at $10-12/user/month (not $20+). Capture the massive market of 20-200 person teams that need enterprise auth but cannot justify Notion Enterprise pricing.

4. **First-class public publishing**: Built-in selective publishing with custom domains, granular visibility controls, reader analytics, and commenting. No separate paid add-on.

5. **Stable, well-documented plugin API**: If building an extension system, invest in API documentation, versioning, and backward compatibility from day one. The Obsidian ecosystem proves that great plugins drive adoption -- but also that sparse docs and breaking changes drive developers away.

6. **Self-hosting that actually works**: Provide a Docker deployment with built-in sync, automatic backups, and multi-user support. Address the maintenance fatigue that causes self-hosters to give up.

7. **Performance as a feature**: Target <1 second load time for vaults up to 100,000 notes. Optimize for mobile from the start, not as an afterthought. This is table stakes but most apps fail at scale.

8. **Content freshness for teams**: Built-in document ownership, staleness detection, and verification workflows. This is the enterprise wiki killer feature that no note-taking app has implemented.

---

## Sources

### Obsidian Forum
- [Has anyone else had a negative experience trying to release a plugin for Obsidian?](https://forum.obsidian.md/t/has-anyone-else-had-a-negative-experience-trying-to-release-a-plugin-for-obsidian/91762)
- [Search function works very poorly in Obsidian](https://forum.obsidian.md/t/search-function-works-very-poorly-in-obsidian/87704)
- [Fuzzy search doesn't work in linking/autocomplete](https://forum.obsidian.md/t/fuzzy-search-doesnt-work-in-linking-autocomplete/84723)
- [Full-text search not working on Publish site](https://forum.obsidian.md/t/full-text-search-not-working-on-publish-site/84792)
- [Large vault on desktop: Loading workspace takes a long time](https://forum.obsidian.md/t/large-vault-on-desktop-loading-workspace-takes-a-long-time/81721)
- [Performance Issues on iPhone 14 Pro with Large Vault (~40,000 notes)](https://forum.obsidian.md/t/performance-issues-on-iphone-14-pro-with-large-vault-40-000-notes-using-obsidian-sync/98759)
- [Obsidian Sync: Live team collaborative editing (feature request)](https://forum.obsidian.md/t/obsidian-sync-live-team-collaborative-editing/6058)
- [Where are the developer docs people are praising?](https://forum.obsidian.md/t/where-are-the-developer-docs-people-are-praising/65982)
- [Documentation for API methods & properties?](https://forum.obsidian.md/t/documentation-for-api-methods-properties/23048)
- [Is it normal to wait for a plugin approval for almost a month?](https://forum.obsidian.md/t/is-it-normal-to-wait-for-a-plugin-approval-for-almost-a-month/87092)
- [Search is slower in Obsidian 1.9.10](https://forum.obsidian.md/t/search-is-slower-in-obsidian-1-9-10-electron-37/104418)
- [Improve fuzzy search algorithm for better suggestions](https://forum.obsidian.md/t/improve-fuzzy-search-algorithm-for-better-suggestions/1322)
- [Obsidian Publish alternatives](https://forum.obsidian.md/t/obsidian-publish-alternatives/22886)

### Logseq Forum
- [Concerns on DB Version and Future State from a 3+ Year User](https://discuss.logseq.com/t/concerns-on-db-version-and-future-state-from-a-3-year-user/29225)
- [The endless wait for Logseq DB](https://discuss.logseq.com/t/the-endless-wait-for-logseq-db/33283)
- [Database version: too drastic choice?](https://discuss.logseq.com/t/database-version-too-drastic-choice/20346)
- [Is git the only truly reliable self-hosted sync for multiple devices in 2025?](https://discuss.logseq.com/t/discussion-is-git-the-only-truly-reliable-self-hosted-sync-for-multiple-devices-in-2025/33502)

### Hacker News
- [Ask HN: What note taking app do you use and why? (Aug 2024)](https://news.ycombinator.com/item?id=41228758)
- [My Obsidian note-taking workflow (Aug 2024)](https://news.ycombinator.com/item?id=41092928)
- [How I use Obsidian (HN discussion, 2026)](https://news.ycombinator.com/item?id=47054369)
- [Show HN: I built an app that competes with Notion and Obsidian (May 2024)](https://news.ycombinator.com/item?id=40440701)
- [Fast is relative -- Notion vs Obsidian speed (Jul 2025)](https://news.ycombinator.com/item?id=44740180)

### GitHub
- [obsidian-api: Type definitions for the Obsidian API](https://github.com/obsidianmd/obsidian-api)
- [obsidian-typings: TypeScript typings for undocumented Obsidian API](https://github.com/Fevol/obsidian-typings)
- [obsidian-extra: Utilities for undocumented API](https://github.com/eth-p/obsidian-extra)
- [Pubsidian: Free Obsidian Publish alternative](https://github.com/yoursamlan/pubsidian)
- [Digital Garden plugin for Obsidian](https://github.com/oleeskild/obsidian-digital-garden)

### Review Sites & Articles
- [Obsidian Review: What Nobody Tells You About This App (2026)](https://thebusinessdive.com/obsidian-review)
- [I still use Obsidian, but I wish they'd fix its plugin dependency](https://www.xda-developers.com/obsidians-reliance-on-plugins/)
- [10 Problems with Obsidian You'll Realize When It's Too Late](https://medium.com/@theo-james/10-problems-with-obsidian-youll-realize-when-it-s-too-late-17e903886847)
- [AFFiNE Review (Toksta, 2025)](https://www.toksta.com/products/affine)
- [AFFiNE Reviews (Product Hunt, 2026)](https://www.producthunt.com/products/affine-2/reviews)
- [Switched from Notion to AFFiNE, found Notesnook better than both (XDA)](https://www.xda-developers.com/switched-from-notion-to-affine-notesnook-better-than-both/)
- [Logseq Migration Journey: Challenges, Delays, and Hopes](https://www.solanky.dev/p/logseq-migration-journey-challenges-delays-and-hopes)
- [Notion Offline Mode Explained (TaskFoundry)](https://www.taskfoundry.com/2025/08/notion-offline-mode-setup-sync-conflict-guide.html)
- [Notion Offline Mode Review 2025: Surprises and Disappointments](https://21notion.com/en/blog/notion-offline-mode-review-2025)
- [Notion vs Obsidian: 1 Clear Winner in 7 Tests (2026)](https://tech-insider.org/notion-vs-obsidian-2026/)
- [Capacities vs Obsidian vs Notion vs Logseq: 2025 Feature Comparison](https://medium.com/@ann_p/capacities-vs-obsidian-vs-notion-vs-logseq-2025-feature-comparison-72bff05e496c)
- [I Wasted 43 Hours Picking a Damn Note-taking App](https://anshulkumar.substack.com/p/i-wasted-43-hours-picking-a-damn)
- [Why I switched from Obsidian (DEV Community)](https://dev.to/dev_tips/why-i-switched-from-obsidian-a-real-developers-story-and-what-im-using-now-ndn)
- [Comparing the Top 6 Self-Hosted Note-Taking Apps (xTom)](https://xtom.com/blog/comparing-top-self-hosted-note-taking-apps/)
- [Collaborative Text Editing without CRDTs or OT (Matthew Weidner, 2025)](https://mattweidner.com/2025/05/21/text-without-crdts.html)
- [Building Collaborative Interfaces: OT vs CRDTs (DEV Community)](https://dev.to/puritanic/building-collaborative-interfaces-operational-transforms-vs-crdts-2obo)
- [Notion Pricing Explained (2026)](https://www.gend.co/blog/notion-pricing)
- [Notion SAML SSO Help Center](https://www.notion.com/help/saml-sso-configuration)
- [Notion Enterprise Security Provisions](https://www.notion.com/help/guides/notion-enterprise-security-provisions)
- [Row-Level Permissions in Notion Databases](https://cybersierra.co/blog/notion-row-permissions-setup/)
- [How Secure Is Notion? 11 Mistakes You Must Avoid](https://matthiasfrank.de/en/notion-security/)
- [Relay: Real-time multiplayer plugin for Obsidian](https://relay.md/)
- [Services I stopped self-hosting in 2025 (XDA)](https://www.xda-developers.com/services-stopped-self-hosting-in-2025-what-im-doing-instead/)
- [Best PKM App for Sharing a Digital Garden (AFFiNE blog)](https://affine.pro/blog/best-pkm-app-for-sharing-a-digital-garden)
- [The 2026 Note-Taking App Landscape (Sugggest)](https://sugggest.com/blog/best-note-taking-apps-2026)
