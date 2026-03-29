---
title: Events API
description: Subscribe to note changes, workspace events, and plugin events.
---

# Events API

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Available Events

| Event               | Payload               | Description             |
| ------------------- | --------------------- | ----------------------- |
| `note.opened`       | `{ noteId }`          | User opened a note      |
| `note.closed`       | `{ noteId }`          | User closed a note      |
| `note.saved`        | `{ noteId, content }` | Note was saved          |
| `note.created`      | `{ noteId, title }`   | New note created        |
| `note.deleted`      | `{ noteId }`          | Note moved to trash     |
| `workspace.changed` | `{ workspaceId }`     | User switched workspace |
| `member.joined`     | `{ userId }`          | New member joined       |

## Subscribing to Events

```typescript
const unsubscribe = sdk.events.on('note.saved', ({ noteId, content }) => {
  console.log(`Note ${noteId} saved with content length: ${content.length}`);
});

// Unsubscribe when done
sdk.events.onUnload(() => unsubscribe());
```
