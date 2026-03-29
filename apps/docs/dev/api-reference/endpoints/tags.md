---
title: Tags Endpoints
description: List, create, and delete tags across a workspace.
---

# Tags Endpoints

:::info Coming Soon
This page is under construction. Full interactive API reference is available at `/api/docs`.
:::

## List Tags

```
GET /api/v1/workspaces/:workspaceId/tags
```

Response:

```json
{
  "data": [
    { "id": "tag_1", "name": "meeting", "noteCount": 42 },
    { "id": "tag_2", "name": "project", "noteCount": 17 }
  ]
}
```

## Get Notes by Tag

```
GET /api/v1/tags/:tagId/notes
```

## Delete Tag

```
DELETE /api/v1/tags/:tagId
```

Deletes the tag from all notes that use it.
