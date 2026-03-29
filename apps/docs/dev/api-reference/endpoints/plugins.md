---
title: Plugins Endpoints
description: Plugin management and registry endpoints.
---

# Plugins Endpoints

:::info Coming Soon
This page is under construction. Full interactive API reference is available at `/api/docs`.
:::

## List Installed Plugins

```
GET /api/v1/workspaces/:workspaceId/plugins
```

## Install Plugin

```
POST /api/v1/workspaces/:workspaceId/plugins
```

Body:

```json
{ "pluginId": "notesaner-mermaid", "version": "1.2.0" }
```

## Enable / Disable Plugin

```
PATCH /api/v1/workspaces/:workspaceId/plugins/:pluginId
```

Body:

```json
{ "enabled": false }
```

## Uninstall Plugin

```
DELETE /api/v1/workspaces/:workspaceId/plugins/:pluginId
```
