---
title: Plugin Manifest Reference
description: All manifest.json fields, versioning, and permissions declaration.
---

# Plugin Manifest Reference

The `manifest.json` file at the root of a plugin defines its identity, capabilities, and metadata.

## Full Manifest Schema

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A description of what my plugin does.",
  "author": "Your Name",
  "authorUrl": "https://example.com",
  "repository": "https://github.com/username/my-plugin",
  "license": "MIT",
  "minAppVersion": "1.0.0",
  "entrypoint": "dist/index.js",
  "capabilities": [
    "notes.read",
    "notes.write",
    "ui.sidebar-panel",
    "ui.toolbar-button",
    "storage.local",
    "network"
  ]
}
```

## Required Fields

| Field           | Type   | Description                   |
| --------------- | ------ | ----------------------------- |
| `id`            | string | Unique plugin ID (kebab-case) |
| `name`          | string | Display name                  |
| `version`       | string | SemVer version                |
| `description`   | string | One-line description          |
| `entrypoint`    | string | Path to built JS bundle       |
| `minAppVersion` | string | Minimum Notesaner version     |

## Capabilities

| Capability          | Access                                 |
| ------------------- | -------------------------------------- |
| `notes.read`        | Read note content and metadata         |
| `notes.write`       | Create and modify notes                |
| `workspace.read`    | Read workspace info and settings       |
| `ui.sidebar-panel`  | Add a panel to the sidebar             |
| `ui.toolbar-button` | Add a button to the editor toolbar     |
| `ui.command`        | Add commands to the command palette    |
| `storage.local`     | Read/write plugin-local storage        |
| `network`           | Make network requests to external URLs |
| `events.subscribe`  | Subscribe to workspace events          |
