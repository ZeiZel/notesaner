---
title: WebSocket Events Reference
description: Yjs sync events, presence events, and comment events over WebSocket.
---

# WebSocket Events Reference

Notesaner uses WebSockets for real-time features: collaborative editing (Yjs), presence, and comments.

## Connecting

```
wss://notesaner.example.com/api/sync?noteId=<noteId>&token=<jwt>
```

## Yjs Sync Events

These are binary messages using the Yjs protocol (not JSON). Use the Yjs client library to handle them.

| Direction       | Type               | Description                   |
| --------------- | ------------------ | ----------------------------- |
| Client → Server | `sync-step-1`      | Client sends its state vector |
| Server → Client | `sync-step-2`      | Server sends missing updates  |
| Bidirectional   | `update`           | Incremental document update   |
| Client → Server | `awareness-update` | Cursor/selection position     |
| Server → Client | `awareness-update` | Other clients' positions      |

## Presence Events (JSON)

| Event             | Direction       | Payload                          |
| ----------------- | --------------- | -------------------------------- |
| `presence.join`   | Server → Client | `{ userId, displayName, color }` |
| `presence.leave`  | Server → Client | `{ userId }`                     |
| `presence.cursor` | Server → Client | `{ userId, position }`           |

## Comment Events (JSON)

| Event              | Direction       | Payload                                  |
| ------------------ | --------------- | ---------------------------------------- |
| `comment.created`  | Server → Client | `{ commentId, noteId, content, author }` |
| `comment.resolved` | Server → Client | `{ commentId }`                          |
| `comment.deleted`  | Server → Client | `{ commentId }`                          |
