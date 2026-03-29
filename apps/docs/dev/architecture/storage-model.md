---
title: Storage Model
description: MD files as source of truth, PostgreSQL for metadata and FTS, file watcher.
---

# Storage Model

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Source of Truth: Markdown Files

Note content is stored as `.md` files on the filesystem. PostgreSQL stores metadata only.

## Filesystem Layout

```
/data/notes/
└── {workspaceId}/
    ├── Getting Started.md
    ├── Project Alpha/
    │   ├── Meeting Notes.md
    │   └── attachments/
    │       └── diagram.png
    └── Journal/
        ├── 2026-03-29.md
        └── 2026-03-28.md
```

## PostgreSQL Metadata

PostgreSQL stores what can't be efficiently derived from files:

- User accounts and authentication
- Workspace memberships and permissions
- Note metadata: title, path, modified_at, workspace_id
- Tags and tag-note associations
- Full-text search index (`tsvector`)
- API keys, sessions

## Sync Between FS and DB

When a note is saved:

1. Markdown written to filesystem
2. Metadata updated in PostgreSQL
3. FTS index updated via `to_tsvector(content)`

A file watcher detects external file changes and syncs metadata back to PostgreSQL.
