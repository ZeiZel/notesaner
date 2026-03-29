---
title: Folders Endpoints
description: Create, list, rename, and delete note folders.
---

# Folders Endpoints

:::info Coming Soon
This page is under construction. Full interactive API reference is available at `/api/docs`.
:::

## List Folders

```
GET /api/v1/workspaces/:workspaceId/folders
```

## Create Folder

```
POST /api/v1/workspaces/:workspaceId/folders
```

Body:

```json
{ "path": "Projects/Alpha" }
```

## Rename Folder

```
PATCH /api/v1/folders/:folderId
```

## Delete Folder

```
DELETE /api/v1/folders/:folderId
```

:::warning
Deleting a folder moves all contained notes to the Trash.
:::
