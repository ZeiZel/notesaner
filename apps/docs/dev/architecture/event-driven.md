---
title: Event-Driven Architecture (CQRS)
description: CQRS pattern, event types, async event handlers in NestJS.
---

# Event-Driven Architecture (CQRS)

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

Notesaner uses NestJS's built-in `@nestjs/cqrs` module for event-driven patterns.

## Event Types

| Event                  | Trigger              | Handlers                                 |
| ---------------------- | -------------------- | ---------------------------------------- |
| `NoteCreated`          | New note saved       | Update search index, send activity event |
| `NoteUpdated`          | Note content changed | Update search index, update metadata     |
| `NoteDeleted`          | Note moved to trash  | Remove from search index, cleanup        |
| `WorkspaceMemberAdded` | User invited         | Send welcome email, create audit log     |
| `PluginInstalled`      | Plugin installed     | Validate manifest, setup permissions     |

## CQRS Pattern

Commands: mutating operations (create, update, delete)
Queries: read operations (get note, search)
Events: side effects after a command succeeds

This separation makes testing easier and allows async side effects without coupling.
