---
title: Plugin Architecture Overview
description: How Notesaner plugins load, the sandbox boundary, and lifecycle hooks.
---

# Plugin Architecture Overview

Notesaner plugins run in isolated iframes. This page explains the plugin loading process, sandbox model, and lifecycle.

## Plugin Types

| Type                 | Description                                        |
| -------------------- | -------------------------------------------------- |
| **Panel plugin**     | Adds a panel to the left or right sidebar          |
| **Editor extension** | Adds new block types or marks to the TipTap editor |
| **Toolbar plugin**   | Adds buttons to the editor toolbar                 |
| **Command plugin**   | Adds commands to the command palette               |
| **Theme plugin**     | Provides a CSS theme                               |

## Loading Process

```
1. User installs plugin (downloads manifest + bundle)
2. Plugin manifest is validated (permissions, version)
3. User approves permissions
4. Plugin stored in workspace plugin store
5. On workspace load:
   a. Create <iframe sandbox="allow-scripts">
   b. Load plugin bundle into iframe
   c. Plugin SDK initializes within iframe
   d. Plugin registers itself with SDK
   e. Host bridge sends initial context
   f. Plugin renders
```

## Sandbox Boundary

The iframe sandbox prevents plugins from:

- Accessing the parent window (`window.parent` is blocked)
- Reading/writing localStorage or cookies of the host
- Making network requests to unauthorized origins (unless `network` capability granted)
- Modifying the host DOM directly

All plugin-to-host communication uses the [postMessage protocol](/docs/plugin-development/guides/postmessage).

## Lifecycle Hooks

```typescript
import { definePlugin } from '@notesaner/plugin-sdk';

export default definePlugin({
  id: 'my-plugin',

  onLoad(context) {
    // Plugin loaded — register UI, subscribe to events
  },

  onNoteOpen(noteId) {
    // User opened a note
  },

  onNoteClose(noteId) {
    // User closed a note
  },

  onUnload() {
    // Cleanup before plugin is disabled
  },
});
```

## See Also

- [Your First Plugin](/docs/plugin-development/getting-started/hello-world)
- [Plugin SDK Overview](/docs/plugin-development/sdk/overview)
- [Security Model](/docs/plugin-development/security/sandbox)
