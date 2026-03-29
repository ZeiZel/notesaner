---
title: Real-Time Collaboration Overview
description: How Yjs CRDT enables conflict-free real-time collaboration in Notesaner.
---

# Real-Time Collaboration Overview

Notesaner supports real-time collaborative editing — multiple users can edit the same note simultaneously without conflicts.

## How It Works

Collaboration is powered by **Yjs**, a Conflict-free Replicated Data Type (CRDT) library. CRDTs ensure that all users' edits are merged automatically, even if they happened simultaneously or while one user was offline.

### The Sync Flow

1. User A and User B both open the same note
2. Both users are connected to the Notesaner WebSocket server
3. Every keystroke is encoded as a Yjs update and broadcast to all connected clients
4. Yjs automatically merges updates — there are no conflicts
5. Every 500ms, the merged state is persisted to the filesystem

## Presence

See who else is viewing or editing the current note via [Presence Indicators](/help/collaboration/presence).

## Offline Editing

If you lose connectivity while editing, your changes are queued locally. When reconnected, Yjs merges your offline changes with any changes made by others — no manual conflict resolution needed.

## See Also

- [Invite Collaborators](/help/collaboration/invite)
- [Comments & Mentions](/help/collaboration/comments)
- [Conflict Resolution](/help/collaboration/conflict-resolution)
