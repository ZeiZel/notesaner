# Beads Task Audit Report

**Date**: 2026-03-28
**Analyst**: spec-analyst

---

## Executive Summary

Full audit of all Beads tasks for the Notesaner project. Reviewed 48 open tasks, 0 in-progress tasks, and 130+ closed tasks. Identified task quality issues, missing features, and critical UX corrections needed.

## Part 1: Existing Task Quality Fixes

### Duplicate Resolved

| Task          | Action              | Details                                 |
| ------------- | ------------------- | --------------------------------------- |
| notesaner-tru | CLOSED as duplicate | Merged into notesaner-djq5 (onboarding) |

### Tasks Updated with Better Acceptance Criteria

| Task           | Title                           | Issue                                         |
| -------------- | ------------------------------- | --------------------------------------------- |
| notesaner-djq5 | Onboarding flow                 | Was vague, now has step-by-step criteria      |
| notesaner-cfm  | Floating/detachable windows     | Was a paragraph dump, now structured AC       |
| notesaner-8w8y | Maximize/minimize panel         | Was a paragraph dump, now structured AC       |
| notesaner-jek  | Ribbon quick-action icons       | Was a paragraph dump, now structured AC       |
| notesaner-5wi  | Note sharing and guest access   | Enhanced with share link UX details           |
| notesaner-4xa  | PWA manifest and service worker | Enhanced with offline strategy details        |
| notesaner-s8q7 | next-intl i18n setup            | Enhanced with message namespace structure     |
| notesaner-0i01 | Semantic search                 | Enhanced with embedding pipeline details      |
| notesaner-a6x  | Smart import wizard             | Enhanced with step-by-step wizard flow        |
| notesaner-jze  | Note export                     | Enhanced with format-specific details         |
| notesaner-3ul  | Workspace search and replace    | Enhanced with regex/filter/undo details       |
| notesaner-4wq  | Multi-workspace support         | Enhanced with isolation and switching details |
| notesaner-86r  | Quick capture modal             | Enhanced with performance and UX details      |
| notesaner-w7j  | Favorites and bookmarks         | Enhanced with pinned tabs and recently opened |
| notesaner-7og  | Activity feed and notifications | Enhanced with @mention and follow details     |
| notesaner-1qj4 | Timeline view                   | Enhanced with grouping and filter details     |
| notesaner-hjtr | Note alias support              | Enhanced with search/backlink resolution      |
| notesaner-y6lq | Workspace storage quota         | Enhanced with threshold warnings and alerts   |

## Part 2: Missing Feature Tasks Created

### Critical UX Requirements (from user)

| Task ID        | Title                                            | Priority | Details                              |
| -------------- | ------------------------------------------------ | -------- | ------------------------------------ |
| notesaner-rb7q | Free-form window grid system                     | P1       | Drag, resize, arbitrary grid layouts |
| notesaner-gciy | Global tab bar for all open buffers              | P1       | Single unified tab bar, not per-pane |
| notesaner-loyh | Dual sidebars with drag-drop panel rearrangement | P1       | Panels draggable between sidebars    |

**Dependencies**: notesaner-gciy depends on notesaner-rb7q (grid must exist before tab bar can reference panes)

### UX Correction Notes

The following closed tasks have descriptions that CONTRADICT the new UX requirements:

- **notesaner-vad** (split pane, closed): Says "Each pane has its own tab bar" -- WRONG per Requirement B
- **notesaner-ed8** (tab bar, closed): Describes per-pane tab bars -- WRONG per Requirement B

The new tasks (notesaner-rb7q, notesaner-gciy, notesaner-loyh) SUPERSEDE these behaviors. Implementation agents should follow the new task descriptions.

### New Feature Tasks

| Task ID        | Title                                           | Priority | Category      |
| -------------- | ----------------------------------------------- | -------- | ------------- |
| notesaner-j667 | Text highlight/mark extension                   | P2       | Editor        |
| notesaner-unxp | Heading fold/collapse                           | P2       | Editor        |
| notesaner-9idj | Superscript and subscript                       | P3       | Editor        |
| notesaner-5aip | Toggle list (details/summary)                   | P2       | Editor        |
| notesaner-avry | Automated backup and disaster recovery          | P1       | DevOps        |
| notesaner-jkry | Observability stack (logging, metrics, tracing) | P1       | DevOps        |
| notesaner-tjer | React error boundaries and fallback UI          | P1       | Frontend      |
| notesaner-k3qp | Email notification system (backend)             | P2       | Backend       |
| notesaner-vidn | In-app notification center UI                   | P2       | Frontend      |
| notesaner-5cgb | Database seed data and dev fixtures             | P2       | Backend       |
| notesaner-ccc2 | Saved searches and search operators             | P2       | Search        |
| notesaner-m0on | WCAG 2.1 AA accessibility compliance            | P1       | Frontend      |
| notesaner-q1xa | Dark/light mode toggle with system detection    | P1       | Frontend      |
| notesaner-knu5 | Rate limiting and abuse prevention              | P1       | Security      |
| notesaner-i6j4 | Note template system UI                         | P2       | Workspace     |
| notesaner-jrrn | Content Security Policy and security hardening  | P1       | Security      |
| notesaner-v74k | Drag-and-drop note organization                 | P2       | Frontend      |
| notesaner-xt78 | Workspace settings page                         | P1       | Frontend      |
| notesaner-iyfw | User preferences API                            | P1       | Backend       |
| notesaner-9cri | Global keyboard shortcut manager                | P1       | Frontend      |
| notesaner-l1q1 | Note duplicate and copy-to-folder               | P2       | Workspace     |
| notesaner-efkr | Real-time presence cursors in editor            | P1       | Collaboration |
| notesaner-jnwd | CDN and static asset caching strategy           | P2       | Performance   |
| notesaner-dqeb | Graph view filtering and search integration     | P2       | Graph         |
| notesaner-89hf | API key management for programmatic access      | P2       | Auth          |
| notesaner-tdo1 | Undo/redo toolbar integration                   | P2       | Editor        |
| notesaner-ho0v | Database migration strategy                     | P2       | Backend       |
| notesaner-mes3 | Print and print-to-PDF support                  | P3       | Frontend      |
| notesaner-9rd3 | Webhook system for external integrations        | P3       | Backend       |

### Dependencies Created

| Dependent Task                   | Depends On                            | Reason                                |
| -------------------------------- | ------------------------------------- | ------------------------------------- |
| notesaner-gciy (global tab bar)  | notesaner-rb7q (grid system)          | Tab bar must interact with grid panes |
| notesaner-vidn (notification UI) | notesaner-k3qp (notification backend) | UI needs API endpoints                |

## Part 3: Coverage Analysis

### Well-Covered Areas

- Editor extensions (TipTap): comprehensive coverage
- Authentication: local, OIDC, SAML, TOTP, RBAC all covered
- Plugin system: SDK, sandbox, loader, registry, discovery
- Sync/collaboration: Yjs, WebSocket, offline, awareness
- Search: FTS, fuzzy, semantic (open), filters
- Graph view: rendering, local view, WebGL, clustering
- Publishing: SSR, SEO, custom domains, themes, analytics
- CI/CD: GitHub Actions, Docker, NX affected
- Testing: Vitest, Playwright, coverage, benchmarks

### Previously Missing (Now Created)

- Backup/disaster recovery
- Observability (structured logging, metrics, tracing)
- Error boundaries (graceful crash recovery)
- Notification system (in-app + email)
- Accessibility implementation (not just testing)
- Security hardening (CSP, HSTS, etc.)
- User preferences sync API
- Keyboard shortcut manager runtime
- Database seed/fixtures for development
- Print support

### Remaining Gaps (Low Priority, Future Consideration)

- Spell check integration
- Voice note recording
- Third-party calendar integration (Google Calendar, etc.)
- Native desktop app (Electron/Tauri) -- currently PWA only
- Version control integration (Git backend for notes)
- Multi-language spell check dictionaries
- Data portability compliance (GDPR export)
- Automated accessibility scanning in CI

## Summary Statistics

| Metric                       | Count |
| ---------------------------- | ----- |
| Tasks reviewed               | 178+  |
| Duplicate closed             | 1     |
| Tasks updated (descriptions) | 18    |
| New tasks created            | 29    |
| New dependencies added       | 2     |
| Open tasks (current)         | ~75   |
| Closed tasks                 | ~130  |
