---
title: Notes Endpoints
description: CRUD operations for notes — create, read, update, delete, search, move.
---

# Notes Endpoints

:::info
Full interactive API reference is available at `/api/docs` on your Notesaner instance.
:::

## List Notes

```
GET /api/v1/workspaces/:workspaceId/notes
```

Query parameters:

- `folder` — filter by folder path
- `tag` — filter by tag
- `search` — full-text search query
- `limit`, `cursor` — pagination

## Get Note

```
GET /api/v1/notes/:noteId
```

## Create Note

```
POST /api/v1/workspaces/:workspaceId/notes
```

Body:

```json
{
  "title": "My Note",
  "content": "# Hello\n\nThis is my note.",
  "folder": "Projects/",
  "tags": ["project", "alpha"]
}
```

## Update Note

```
PATCH /api/v1/notes/:noteId
```

## Delete Note (to Trash)

```
DELETE /api/v1/notes/:noteId
```

## Move Note

```
POST /api/v1/notes/:noteId/move
```

Body:

```json
{ "folder": "Archive/2026/" }
```

## Get Note History

```
GET /api/v1/notes/:noteId/history
```
