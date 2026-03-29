---
title: Plugin Registry Overview
description: The GitHub-based Notesaner plugin registry — how it works and how plugins are distributed.
---

# Plugin Registry Overview

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

The Notesaner Plugin Registry is a GitHub repository (`notesaner/plugin-registry`) that lists all approved community plugins.

## Registry Format

Each plugin is listed as a JSON entry in `plugins.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.2.0",
  "author": "Your Name",
  "description": "Plugin description",
  "repository": "https://github.com/username/my-plugin",
  "downloadUrl": "https://github.com/username/my-plugin/releases/download/v1.2.0/plugin.zip",
  "capabilities": ["notes.read", "ui.sidebar-panel"],
  "categories": ["productivity"]
}
```

## Installation Flow

1. User browses/searches the registry in Notesaner
2. User clicks **Install**
3. Notesaner fetches the plugin ZIP from `downloadUrl`
4. Manifest is validated
5. User approves permissions
6. Plugin is installed to workspace
