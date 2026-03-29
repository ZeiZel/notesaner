---
title: Plugin API Overview
description: The @notesaner/plugin-sdk package — what it provides and how to use it.
---

# Plugin SDK Overview

The Plugin SDK (`libs/plugin-sdk` / `@notesaner/plugin-sdk`) provides the API surface for building Notesaner plugins.

## Installation

Inside a plugin project:

```bash
pnpm add @notesaner/plugin-sdk
```

## Core Exports

```typescript
import {
  definePlugin, // Plugin entry point factory
  createPanel, // Create a sidebar panel
  createCommand, // Register a command palette command
  useNote, // Access current note
  useWorkspace, // Access workspace context
} from '@notesaner/plugin-sdk';
```

## SDK Architecture

The SDK runs inside the iframe. When a plugin calls `sdk.notes.read(noteId)`, the SDK:

1. Serializes the call to a postMessage request
2. Sends it to the host via `window.parent.postMessage`
3. Waits for the response
4. Returns the result to the plugin

All SDK methods return Promises.

## API Modules

| Module         | Description                                                                           |
| -------------- | ------------------------------------------------------------------------------------- |
| `sdk.notes`    | [Editor API](/docs/plugin-development/sdk/editor-api) — read/write note content       |
| `sdk.storage`  | [Storage API](/docs/plugin-development/sdk/storage-api) — note file access            |
| `sdk.ui`       | [UI API](/docs/plugin-development/sdk/ui-api) — render components, register panels    |
| `sdk.events`   | [Events API](/docs/plugin-development/sdk/events-api) — subscribe to workspace events |
| `sdk.settings` | [Settings API](/docs/plugin-development/sdk/settings-api) — plugin settings panel     |
