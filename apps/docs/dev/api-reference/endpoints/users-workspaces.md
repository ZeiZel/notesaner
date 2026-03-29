---
title: Users & Workspaces Endpoints
description: User profile, workspace management, and member management endpoints.
---

# Users & Workspaces Endpoints

:::info Coming Soon
This page is under construction. Full interactive API reference is available at `/api/docs`.
:::

## Get Current User

```
GET /api/v1/users/me
```

## Update Profile

```
PATCH /api/v1/users/me
```

## List Workspaces

```
GET /api/v1/workspaces
```

## Create Workspace

```
POST /api/v1/workspaces
```

## Get Workspace Members

```
GET /api/v1/workspaces/:workspaceId/members
```

## Invite Member

```
POST /api/v1/workspaces/:workspaceId/members
```

Body:

```json
{ "email": "user@example.com", "role": "editor" }
```

## Remove Member

```
DELETE /api/v1/workspaces/:workspaceId/members/:userId
```
