---
title: Real-Time Sync (Yjs CRDT)
description: How Yjs documents are synced, WebSocket transport, debounce, and persistence.
---

# Real-Time Sync (Yjs CRDT)

Notesaner uses [Yjs](https://yjs.dev) for real-time collaborative editing.

## How Yjs Works

Yjs is a CRDT (Conflict-free Replicated Data Type) library. It represents document state as a series of operations that can be merged in any order without conflicts.

### Key Concepts

- **Y.Doc**: The root Yjs document, contains all shared data
- **Y.Text**: A shared text type (used for note content)
- **Update**: A binary delta encoding one or more changes
- **Awareness**: A separate channel for ephemeral state (cursors, selection)

## Sync Architecture

```
Client A              Server              Client B
──────                ──────              ──────
Type text
  │
  ▼
Yjs encodes
update binary
  │
  ▼
Send update ──────────► Receive
                         │
                         ├──► Broadcast ──────────► Receive + merge
                         │
                         ├──► Merge with server Y.Doc
                         │
                         └──► Debounce 500ms ──► Persist to filesystem
```

## Implementation

The sync is implemented in `libs/sync-engine/`:

```typescript
// libs/sync-engine/src/sync-provider.ts
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function createSyncProvider(noteId: string, doc: Y.Doc) {
  const provider = new WebsocketProvider(WS_URL, `note-${noteId}`, doc);
  return provider;
}
```

## Persistence

The server maintains an in-memory `Y.Doc` per active note. On change:

1. The Yjs update is applied to the server doc
2. After 500ms debounce, the doc is serialized to Markdown
3. The Markdown is written to the filesystem
4. PostgreSQL metadata (modified_at, etc.) is updated

When a note is first opened, the server:

1. Reads the Markdown file
2. Parses it into a TipTap/Yjs-compatible structure
3. Initializes the Y.Doc with the content
4. Sends the initial state to the connecting client

## Offline Support

The `y-indexeddb` persistence provider caches the Y.Doc in the browser's IndexedDB. When offline, changes accumulate locally. On reconnect, the client sends the accumulated updates to the server.
