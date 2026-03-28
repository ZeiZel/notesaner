import { Prisma, LinkType } from '@prisma/client';
import * as crypto from 'node:crypto';
import { USER_IDS } from './users';
import { WORKSPACE_IDS } from './workspaces';

// ─── Deterministic IDs ───────────────────────────────────────────────────────

export const NOTE_IDS = {
  // Alice's personal vault
  dailyNote: '00000000-0000-4000-d000-000000000001',
  researchNote: '00000000-0000-4000-d000-000000000002',
  readingList: '00000000-0000-4000-d000-000000000003',
  inboxQuickCapture: '00000000-0000-4000-d000-000000000004',
  projectNotesaner: '00000000-0000-4000-d000-000000000005',
  archiveOldIdeas: '00000000-0000-4000-d000-000000000006',

  // Engineering team wiki
  onboarding: '00000000-0000-4000-d000-000000000010',
  archDecisions: '00000000-0000-4000-d000-000000000011',
  apiGuidelines: '00000000-0000-4000-d000-000000000012',
  adr001: '00000000-0000-4000-d000-000000000013',

  // Public garden
  welcomeNote: '00000000-0000-4000-d000-000000000020',
  zettelkasten: '00000000-0000-4000-d000-000000000021',
  evergreen: '00000000-0000-4000-d000-000000000022',
} as const;

export const TAG_IDS = {
  daily: '00000000-0000-4000-e000-000000000001',
  research: '00000000-0000-4000-e000-000000000002',
  reading: '00000000-0000-4000-e000-000000000003',
  onboarding: '00000000-0000-4000-e000-000000000004',
  architecture: '00000000-0000-4000-e000-000000000005',
  api: '00000000-0000-4000-e000-000000000006',
  published: '00000000-0000-4000-e000-000000000007',
  zettelkasten: '00000000-0000-4000-e000-000000000008',
  // Canonical tag set requested by task spec
  project: '00000000-0000-4000-e000-000000000009',
  idea: '00000000-0000-4000-e000-000000000010',
  todo: '00000000-0000-4000-e000-000000000011',
  reference: '00000000-0000-4000-e000-000000000012',
} as const;

export const LINK_IDS = {
  onboardingToApi: '00000000-0000-4000-f000-000000000001',
  archToAdr001: '00000000-0000-4000-f000-000000000002',
  zettelToEvergreen: '00000000-0000-4000-f000-000000000003',
  researchToReading: '00000000-0000-4000-f000-000000000004',
} as const;

// ─── Content Helpers ─────────────────────────────────────────────────────────

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function wordCount(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

// ─── Note Content ────────────────────────────────────────────────────────────

const DAILY_NOTE_CONTENT = `# Daily Note — 2026-03-28

## Morning Review
- [x] Review pull requests
- [ ] Update documentation
- [ ] Prepare sprint demo

## Notes
Had a productive session on the CRDT sync engine. The Yjs integration is working
smoothly with the new debounce strategy (500ms).

## Reading
- [[Research — Distributed Systems|research notes]] about consensus algorithms
- Need to add the new paper to [[Reading List]]

## Evening Reflection
Made good progress today. The key insight was to separate the persistence layer
from the sync layer entirely.

---

*Created with Notesaner*
`;

const RESEARCH_NOTE_CONTENT = `# Research — Distributed Systems

## Consensus Algorithms

### Raft
Raft is designed to be more understandable than Paxos while providing the
same guarantees. Key components:
1. **Leader Election** — uses randomised timeouts
2. **Log Replication** — leader appends entries, followers replicate
3. **Safety** — committed entries are durable across leader changes

### CRDTs
Conflict-free Replicated Data Types allow concurrent updates without
coordination. Relevant for our real-time collaboration:

\`\`\`typescript
// Example: G-Counter CRDT
interface GCounter {
  readonly nodeId: string;
  readonly counts: Map<string, number>;
}

function increment(counter: GCounter): GCounter {
  const next = new Map(counter.counts);
  next.set(counter.nodeId, (next.get(counter.nodeId) ?? 0) + 1);
  return { ...counter, counts: next };
}
\`\`\`

## References
- Ongaro, D. & Ousterhout, J. (2014). *In Search of an Understandable Consensus Algorithm*
- Shapiro, M. et al. (2011). *Conflict-free Replicated Data Types*

> See also: [[Reading List]] for more papers on this topic.
`;

const READING_LIST_CONTENT = `# Reading List

A curated list of papers and articles.

## In Progress
- [ ] "Designing Data-Intensive Applications" — Martin Kleppmann
- [ ] "A Philosophy of Software Design" — John Ousterhout

## Completed
- [x] "Clean Architecture" — Robert C. Martin
- [x] "Domain-Driven Design" — Eric Evans

## Papers
| Title | Authors | Year | Status |
|-------|---------|------|--------|
| CRDT Survey | Shapiro et al. | 2011 | Read |
| Raft Consensus | Ongaro & Ousterhout | 2014 | Read |
| Automerge | Kleppmann & Beresford | 2017 | In Progress |

## Links
- [arXiv CS](https://arxiv.org/list/cs/recent)
- [Papers We Love](https://paperswelove.org/)

![reading-banner](assets/reading-banner.png)
`;

const ONBOARDING_CONTENT = `# Engineering Onboarding Guide

Welcome to the engineering team! This guide will help you get started.

## First Week

### Day 1 — Setup
1. Clone the monorepo: \`git clone git@github.com:notesaner/notesaner.git\`
2. Install dependencies: \`pnpm install\`
3. Copy \`.env.example\` to \`.env.local\`
4. Start the dev stack: \`docker compose up -d\`
5. Run migrations: \`pnpm nx prisma-migrate server\`

### Day 2-3 — Architecture
- Read the [[Architecture Decision Records|ADR index]]
- Review the [[API Design Guidelines]]
- Explore the codebase using \`pnpm nx graph\`

### Day 4-5 — First Contribution
- Pick a "good first issue" from the backlog
- Follow the PR template and get a review

## Tech Stack Overview

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 15 + React 19 | App Router |
| Editor | TipTap + Yjs | Real-time collaboration |
| Backend | NestJS 11 | Clean architecture modules |
| Database | PostgreSQL 17 | Prisma ORM |
| Cache | ValKey 8 | Redis-compatible |
| Queue | BullMQ | Background jobs |

## Key Contacts
- **Tech Lead**: @admin
- **Frontend**: @alice
- **Backend**: @bob
`;

const ARCH_DECISIONS_CONTENT = `# Architecture Decision Records

This page indexes all ADRs for the Notesaner project.

## Active ADRs

| ID | Title | Status | Date |
|----|-------|--------|------|
| [[ADR-001 — Use Yjs for CRDT Sync|ADR-001]] | Use Yjs for CRDT Sync | Accepted | 2026-01-15 |
| ADR-002 | NestJS Clean Architecture Modules | Accepted | 2026-01-20 |
| ADR-003 | PostgreSQL FTS over Elasticsearch | Accepted | 2026-02-01 |
| ADR-004 | Iframe Plugin Sandbox | Proposed | 2026-03-10 |

## Template

\`\`\`markdown
# ADR-NNN — Title

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
What is the issue that motivates this decision?

## Decision
What is the change we are proposing?

## Consequences
What are the trade-offs?
\`\`\`
`;

const ADR_001_CONTENT = `# ADR-001 — Use Yjs for CRDT Sync

## Status
**Accepted** (2026-01-15)

## Context
We need real-time collaborative editing for notes. Options considered:
1. **OT (Operational Transformation)** — Google Docs approach, requires central server
2. **Yjs** — CRDT-based, peer-to-peer capable, works offline
3. **Automerge** — CRDT-based, more opinionated, larger bundle size

## Decision
Use **Yjs** as the CRDT engine for real-time sync.

### Reasons
- Mature ecosystem with TipTap integration (\`@tiptap/extension-collaboration\`)
- WebSocket provider (\`y-websocket\`) fits our NestJS gateway pattern
- Sub-document support for loading note content on demand
- Small bundle size (~15KB gzipped)

## Consequences

### Positive
- Offline-first editing with automatic conflict resolution
- Can sync via WebSocket, WebRTC, or file system
- Active community and well-maintained

### Negative
- Learning curve for CRDT concepts
- Debugging merge conflicts is non-trivial
- State snapshots are binary (Yjs encoding), not human-readable

### Risks
- Yjs document size grows over time (mitigated by periodic garbage collection)
`;

const API_GUIDELINES_CONTENT = `# API Design Guidelines

## General Principles

1. **RESTful conventions** — use HTTP methods semantically
2. **Versioned endpoints** — prefix with \`/api/v1/\`
3. **JSON:API-ish responses** — consistent envelope
4. **Cursor-based pagination** — for all list endpoints

## Request / Response Format

### Success Response
\`\`\`json
{
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO-8601"
  }
}
\`\`\`

### Error Response
\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [ ... ]
  },
  "meta": {
    "requestId": "uuid"
  }
}
\`\`\`

## Authentication
- Bearer JWT in \`Authorization\` header
- Access tokens: 15 min TTL
- Refresh tokens: 30 day TTL, httpOnly cookie
- CSRF token required for cookie-based auth

## Rate Limits
| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Global | 100 req | 60s |
| Auth | 5 req | 60s |
| Search | 30 req | 60s |
| Upload | 10 req | 60s |
`;

const WELCOME_NOTE_CONTENT = `# Welcome to the Open Knowledge Garden

This is a publicly accessible digital garden powered by **Notesaner**.

## What is a Digital Garden?

A digital garden is a collection of evolving ideas, not a chronological blog.
Notes are interconnected through [[Zettelkasten Method|wiki-style links]]
and grow organically over time.

## How to Navigate
- Click on **wiki links** to explore connected ideas
- Use the **graph view** to see relationships
- Browse by **tags** for topic-based exploration

## Featured Notes
- [[Zettelkasten Method]] — The note-taking system behind this garden
- [[Evergreen Notes]] — Writing notes that compound in value

---

> "The garden is the web of connections between ideas, not a linear narrative."

*Maintained by the Notesaner team.*
`;

const ZETTELKASTEN_CONTENT = `# Zettelkasten Method

The Zettelkasten ("slip box") is a personal knowledge management system
developed by sociologist Niklas Luhmann.

## Core Principles

### 1. Atomic Notes
Each note should contain **one idea**. This makes notes reusable and
composable across different contexts.

### 2. Linked Thinking
Notes gain value through connections. Every new note should be linked
to at least one existing note, creating a web of knowledge.

### 3. Unique Identifiers
Each note has a unique ID (in Notesaner, the file path serves this purpose).
Links use these IDs rather than titles, so renaming does not break connections.

### 4. No Categories, Only Links
Traditional folder hierarchies are replaced by bottom-up emergence through
linking. Tags and links are preferred over rigid folder structures.

## In Practice

The modern digital Zettelkasten replaces index cards with Markdown files
and wiki links:

\`\`\`markdown
# My Atomic Note

This note captures a single idea about [[Evergreen Notes]].

It connects to the broader concept of [[Linked Thinking]]
and supports the argument in [[My Research Paper]].
\`\`\`

## Further Reading
- Ahrens, S. (2017). *How to Take Smart Notes*
- Luhmann, N. (1981). *Kommunikation mit Zettelkasten*

See also: [[Evergreen Notes]]
`;

const EVERGREEN_CONTENT = `# Evergreen Notes

Evergreen notes are a concept from Andy Matuschak's note-taking philosophy.
They are designed to **accumulate value over time**.

## Properties of Evergreen Notes

1. **Atomic** — each note captures a single, well-defined concept
2. **Concept-oriented** — titled by the idea, not by the source
3. **Densely linked** — connected to many other notes
4. **Written for your future self** — clear enough to understand months later
5. **Continuously refined** — updated as understanding evolves

## Evergreen vs. Transient Notes

| Property | Evergreen | Transient |
|----------|-----------|-----------|
| Lifespan | Indefinite | Days-weeks |
| Scope | One concept | Meeting notes, TODO lists |
| Links | Many | Few |
| Refinement | Ongoing | Rarely revisited |

## Connection to Zettelkasten

The evergreen note concept is essentially the digital evolution of Luhmann's
Zettelkasten cards. The key addition is the emphasis on **continuous refinement**.

> "The most effective way to build understanding is to write about ideas
> as if they will be useful for decades." — Andy Matuschak

## Related
- [[Zettelkasten Method]]
- [[Spaced Repetition and Note-Taking]]
`;

// ─── Folder-Structure Sample Notes ──────────────────────────────────────────

const INBOX_QUICK_CAPTURE_CONTENT = `# Quick Capture

A scratchpad for fleeting thoughts before they get processed.

## Captured Ideas
- CRDT garbage collection strategy: periodic snapshot + trim history
- Look into TipTap extension for \`/slash\` commands
- Compare Yjs sub-document lazy-loading performance

## TODO
- [ ] Move processed items to [[Projects/Notesaner|project notes]]
- [ ] Archive anything older than 2 weeks
- [ ] Review [[Reading List]] for new additions

> **Inbox Zero Rule**: Process this list daily. Anything not actionable
> within a week should be archived or linked to a project.
`;

const PROJECT_NOTESANER_CONTENT = `# Project: Notesaner

## Status
**Active** | Started: 2026-01-01 | Target: 2026-06-30

## Goals
1. Build a web-first Obsidian alternative
2. Real-time collaboration via Yjs CRDT
3. Plugin ecosystem with iframe sandboxing
4. Self-hostable with Docker

## Milestones

| Milestone | Target | Status |
|-----------|--------|--------|
| Core editor with TipTap | 2026-02 | Done |
| Auth & workspaces | 2026-03 | Done |
| Real-time sync | 2026-04 | In Progress |
| Plugin SDK v1 | 2026-05 | Planned |
| Public beta | 2026-06 | Planned |

## Architecture
- Frontend: Next.js 15, React 19, Ant Design
- Backend: NestJS 11, Prisma 6, PostgreSQL 17
- Sync: Yjs + y-websocket
- Cache: ValKey 8

## Related Notes
- [[Architecture Decision Records]]
- [[API Design Guidelines]]
- [[Research — Distributed Systems]]

#project #todo
`;

const ARCHIVE_OLD_IDEAS_CONTENT = `# Archive: Old Ideas

Ideas that were evaluated and either deferred or rejected.

## Deferred

### Native Desktop App (Electron)
**Decision**: Deferred to v2. Web-first approach covers 90% of use cases.
Focus on PWA support instead.

### MongoDB for Note Storage
**Decision**: Rejected. PostgreSQL with FTS handles our query patterns well,
and we avoid operational complexity of running two databases.

### GraphQL API
**Decision**: Deferred. REST with cursor pagination is simpler for our
current needs. May revisit when plugin API matures.

## Lessons Learned
1. Start with the simplest thing that works
2. Defer complexity until there is clear demand
3. Document *why* decisions were made, not just *what*

---

*Moved from Inbox on 2026-03-15*

#reference
`;

// ─── Fixture Builders ────────────────────────────────────────────────────────

export interface SeedNote {
  id: string;
  workspaceId: string;
  path: string;
  title: string;
  content: string;
  contentHash: string;
  wordCount: number;
  frontmatter: Prisma.InputJsonValue;
  isPublished: boolean;
  isTrashed: boolean;
  createdById: string;
  lastEditedById: string;
}

function buildNote(
  id: string,
  workspaceId: string,
  path: string,
  title: string,
  content: string,
  opts: {
    frontmatter?: Prisma.InputJsonValue;
    isPublished?: boolean;
    createdById?: string;
    lastEditedById?: string;
  } = {},
): SeedNote {
  return {
    id,
    workspaceId,
    path,
    title,
    content,
    contentHash: sha256(content),
    wordCount: wordCount(content),
    frontmatter: opts.frontmatter ?? {},
    isPublished: opts.isPublished ?? false,
    isTrashed: false,
    createdById: opts.createdById ?? USER_IDS.alice,
    lastEditedById: opts.lastEditedById ?? USER_IDS.alice,
  };
}

export function buildNotes(): SeedNote[] {
  return [
    // ── Alice's personal vault ───────────────────────────────────────────
    buildNote(
      NOTE_IDS.dailyNote,
      WORKSPACE_IDS.personal,
      'daily/2026-03-28.md',
      'Daily Note - 2026-03-28',
      DAILY_NOTE_CONTENT,
      { frontmatter: { date: '2026-03-28', type: 'daily' } },
    ),
    buildNote(
      NOTE_IDS.researchNote,
      WORKSPACE_IDS.personal,
      'research/distributed-systems.md',
      'Research - Distributed Systems',
      RESEARCH_NOTE_CONTENT,
      { frontmatter: { tags: ['research', 'distributed-systems'], status: 'wip' } },
    ),
    buildNote(
      NOTE_IDS.readingList,
      WORKSPACE_IDS.personal,
      'reading-list.md',
      'Reading List',
      READING_LIST_CONTENT,
      { frontmatter: { type: 'index' } },
    ),

    // ── Alice's folder structure samples ────────────────────────────────
    buildNote(
      NOTE_IDS.inboxQuickCapture,
      WORKSPACE_IDS.personal,
      'inbox/quick-capture.md',
      'Quick Capture',
      INBOX_QUICK_CAPTURE_CONTENT,
      { frontmatter: { type: 'inbox', tags: ['todo'] } },
    ),
    buildNote(
      NOTE_IDS.projectNotesaner,
      WORKSPACE_IDS.personal,
      'projects/notesaner.md',
      'Project: Notesaner',
      PROJECT_NOTESANER_CONTENT,
      { frontmatter: { type: 'project', status: 'active', tags: ['project', 'todo'] } },
    ),
    buildNote(
      NOTE_IDS.archiveOldIdeas,
      WORKSPACE_IDS.personal,
      'archive/old-ideas.md',
      'Archive: Old Ideas',
      ARCHIVE_OLD_IDEAS_CONTENT,
      { frontmatter: { type: 'archive', tags: ['reference'] } },
    ),

    // ── Engineering team wiki ────────────────────────────────────────────
    buildNote(
      NOTE_IDS.onboarding,
      WORKSPACE_IDS.team,
      'onboarding/guide.md',
      'Engineering Onboarding Guide',
      ONBOARDING_CONTENT,
      { createdById: USER_IDS.admin, lastEditedById: USER_IDS.admin },
    ),
    buildNote(
      NOTE_IDS.archDecisions,
      WORKSPACE_IDS.team,
      'architecture/adrs/index.md',
      'Architecture Decision Records',
      ARCH_DECISIONS_CONTENT,
      {
        createdById: USER_IDS.admin,
        lastEditedById: USER_IDS.alice,
        frontmatter: { type: 'index' },
      },
    ),
    buildNote(
      NOTE_IDS.apiGuidelines,
      WORKSPACE_IDS.team,
      'architecture/api-guidelines.md',
      'API Design Guidelines',
      API_GUIDELINES_CONTENT,
      {
        createdById: USER_IDS.bob,
        lastEditedById: USER_IDS.bob,
        frontmatter: { tags: ['api', 'guidelines'] },
      },
    ),
    buildNote(
      NOTE_IDS.adr001,
      WORKSPACE_IDS.team,
      'architecture/adrs/001-yjs-crdt.md',
      'ADR-001 - Use Yjs for CRDT Sync',
      ADR_001_CONTENT,
      {
        createdById: USER_IDS.admin,
        lastEditedById: USER_IDS.admin,
        frontmatter: { status: 'accepted', date: '2026-01-15' },
      },
    ),

    // ── Public garden ────────────────────────────────────────────────────
    buildNote(
      NOTE_IDS.welcomeNote,
      WORKSPACE_IDS.publicVault,
      'welcome.md',
      'Welcome to the Open Knowledge Garden',
      WELCOME_NOTE_CONTENT,
      {
        isPublished: true,
        createdById: USER_IDS.admin,
        lastEditedById: USER_IDS.admin,
      },
    ),
    buildNote(
      NOTE_IDS.zettelkasten,
      WORKSPACE_IDS.publicVault,
      'methods/zettelkasten.md',
      'Zettelkasten Method',
      ZETTELKASTEN_CONTENT,
      {
        isPublished: true,
        createdById: USER_IDS.alice,
        lastEditedById: USER_IDS.alice,
        frontmatter: { tags: ['zettelkasten', 'methodology'] },
      },
    ),
    buildNote(
      NOTE_IDS.evergreen,
      WORKSPACE_IDS.publicVault,
      'concepts/evergreen-notes.md',
      'Evergreen Notes',
      EVERGREEN_CONTENT,
      {
        isPublished: true,
        createdById: USER_IDS.alice,
        lastEditedById: USER_IDS.alice,
        frontmatter: { tags: ['evergreen', 'note-taking'] },
      },
    ),
  ];
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export interface SeedTag {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
}

export function buildTags(): SeedTag[] {
  return [
    // Personal vault tags
    { id: TAG_IDS.daily, workspaceId: WORKSPACE_IDS.personal, name: 'daily', color: '#3b82f6' },
    {
      id: TAG_IDS.research,
      workspaceId: WORKSPACE_IDS.personal,
      name: 'research',
      color: '#8b5cf6',
    },
    {
      id: TAG_IDS.reading,
      workspaceId: WORKSPACE_IDS.personal,
      name: 'reading',
      color: '#10b981',
    },
    // Canonical tags: #project, #idea, #todo, #reference
    {
      id: TAG_IDS.project,
      workspaceId: WORKSPACE_IDS.personal,
      name: 'project',
      color: '#0ea5e9',
    },
    {
      id: TAG_IDS.idea,
      workspaceId: WORKSPACE_IDS.personal,
      name: 'idea',
      color: '#f59e0b',
    },
    {
      id: TAG_IDS.todo,
      workspaceId: WORKSPACE_IDS.personal,
      name: 'todo',
      color: '#ef4444',
    },
    {
      id: TAG_IDS.reference,
      workspaceId: WORKSPACE_IDS.personal,
      name: 'reference',
      color: '#8b5cf6',
    },

    // Team wiki tags
    {
      id: TAG_IDS.onboarding,
      workspaceId: WORKSPACE_IDS.team,
      name: 'onboarding',
      color: '#f59e0b',
    },
    {
      id: TAG_IDS.architecture,
      workspaceId: WORKSPACE_IDS.team,
      name: 'architecture',
      color: '#ef4444',
    },
    { id: TAG_IDS.api, workspaceId: WORKSPACE_IDS.team, name: 'api', color: '#06b6d4' },

    // Public garden tags
    {
      id: TAG_IDS.published,
      workspaceId: WORKSPACE_IDS.publicVault,
      name: 'published',
      color: '#22c55e',
    },
    {
      id: TAG_IDS.zettelkasten,
      workspaceId: WORKSPACE_IDS.publicVault,
      name: 'zettelkasten',
      color: '#a855f7',
    },
  ];
}

// ─── Note-Tag Associations ───────────────────────────────────────────────────

export interface SeedNoteTag {
  noteId: string;
  tagId: string;
}

export function buildNoteTags(): SeedNoteTag[] {
  return [
    { noteId: NOTE_IDS.dailyNote, tagId: TAG_IDS.daily },
    { noteId: NOTE_IDS.researchNote, tagId: TAG_IDS.research },
    { noteId: NOTE_IDS.readingList, tagId: TAG_IDS.reading },
    { noteId: NOTE_IDS.inboxQuickCapture, tagId: TAG_IDS.todo },
    { noteId: NOTE_IDS.projectNotesaner, tagId: TAG_IDS.project },
    { noteId: NOTE_IDS.projectNotesaner, tagId: TAG_IDS.todo },
    { noteId: NOTE_IDS.archiveOldIdeas, tagId: TAG_IDS.reference },
    { noteId: NOTE_IDS.researchNote, tagId: TAG_IDS.idea },
    { noteId: NOTE_IDS.onboarding, tagId: TAG_IDS.onboarding },
    { noteId: NOTE_IDS.archDecisions, tagId: TAG_IDS.architecture },
    { noteId: NOTE_IDS.apiGuidelines, tagId: TAG_IDS.api },
    { noteId: NOTE_IDS.adr001, tagId: TAG_IDS.architecture },
    { noteId: NOTE_IDS.welcomeNote, tagId: TAG_IDS.published },
    { noteId: NOTE_IDS.zettelkasten, tagId: TAG_IDS.zettelkasten },
    { noteId: NOTE_IDS.zettelkasten, tagId: TAG_IDS.published },
    { noteId: NOTE_IDS.evergreen, tagId: TAG_IDS.published },
  ];
}

// ─── Note Links ──────────────────────────────────────────────────────────────

export interface SeedNoteLink {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  linkType: LinkType;
  context: string | null;
}

export function buildNoteLinks(): SeedNoteLink[] {
  return [
    {
      id: LINK_IDS.onboardingToApi,
      sourceNoteId: NOTE_IDS.onboarding,
      targetNoteId: NOTE_IDS.apiGuidelines,
      linkType: LinkType.WIKI,
      context: 'Review the [[API Design Guidelines]]',
    },
    {
      id: LINK_IDS.archToAdr001,
      sourceNoteId: NOTE_IDS.archDecisions,
      targetNoteId: NOTE_IDS.adr001,
      linkType: LinkType.WIKI,
      context: '[[ADR-001 - Use Yjs for CRDT Sync|ADR-001]]',
    },
    {
      id: LINK_IDS.zettelToEvergreen,
      sourceNoteId: NOTE_IDS.zettelkasten,
      targetNoteId: NOTE_IDS.evergreen,
      linkType: LinkType.WIKI,
      context: 'See also: [[Evergreen Notes]]',
    },
    {
      id: LINK_IDS.researchToReading,
      sourceNoteId: NOTE_IDS.researchNote,
      targetNoteId: NOTE_IDS.readingList,
      linkType: LinkType.WIKI,
      context: 'See also: [[Reading List]] for more papers on this topic.',
    },
  ];
}

// ─── Prisma Upsert Helpers ───────────────────────────────────────────────────

export function getNoteUpserts(): Prisma.NoteUpsertArgs[] {
  return buildNotes().map((n) => ({
    where: {
      workspaceId_path: {
        workspaceId: n.workspaceId,
        path: n.path,
      },
    },
    update: {
      title: n.title,
      contentHash: n.contentHash,
      wordCount: n.wordCount,
      frontmatter: n.frontmatter,
      isPublished: n.isPublished,
      isTrashed: n.isTrashed,
      lastEditedById: n.lastEditedById,
    },
    create: {
      id: n.id,
      workspaceId: n.workspaceId,
      path: n.path,
      title: n.title,
      contentHash: n.contentHash,
      wordCount: n.wordCount,
      frontmatter: n.frontmatter,
      isPublished: n.isPublished,
      isTrashed: n.isTrashed,
      createdById: n.createdById,
      lastEditedById: n.lastEditedById,
    },
  }));
}

export function getTagUpserts(): Prisma.TagUpsertArgs[] {
  return buildTags().map((t) => ({
    where: {
      workspaceId_name: {
        workspaceId: t.workspaceId,
        name: t.name,
      },
    },
    update: {
      color: t.color,
    },
    create: {
      id: t.id,
      workspaceId: t.workspaceId,
      name: t.name,
      color: t.color,
    },
  }));
}

/**
 * Note-tags use a composite PK (noteId, tagId) — no upsert available.
 * We use a deleteMany + createMany strategy that is still idempotent.
 */
export function getNoteTagData(): Array<{ noteId: string; tagId: string }> {
  return buildNoteTags();
}

export function getNoteLinkUpserts(): Prisma.NoteLinkUpsertArgs[] {
  return buildNoteLinks().map((l) => ({
    where: {
      sourceNoteId_targetNoteId_linkType_blockId: {
        sourceNoteId: l.sourceNoteId,
        targetNoteId: l.targetNoteId,
        linkType: l.linkType,
        blockId: '',
      },
    },
    update: {
      context: l.context,
    },
    create: {
      id: l.id,
      sourceNoteId: l.sourceNoteId,
      targetNoteId: l.targetNoteId,
      linkType: l.linkType,
      context: l.context,
    },
  }));
}
