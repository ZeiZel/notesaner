---
title: Search Endpoints
description: Full-text and advanced search across workspace notes.
---

# Search Endpoints

:::info Coming Soon
This page is under construction. Full interactive API reference is available at `/api/docs`.
:::

## Search Notes

```
GET /api/v1/workspaces/:workspaceId/search?q=your+query
```

Query parameters:

- `q` — search query (supports advanced syntax)
- `folder` — restrict to folder
- `tag` — restrict to tag
- `before` — modified before date
- `after` — modified after date
- `limit`, `cursor` — pagination

Response:

```json
{
  "data": [
    {
      "noteId": "note_abc",
      "title": "Meeting Notes",
      "excerpt": "...discussed the **query** topic...",
      "score": 0.95,
      "folder": "Work/Meetings"
    }
  ],
  "pagination": { "nextCursor": null, "hasMore": false, "total": 1 }
}
```
