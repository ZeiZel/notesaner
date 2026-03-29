---
title: Conflict Resolution (Yjs CRDT)
description: What happens when two people edit the same note simultaneously.
---

# Conflict Resolution (Yjs CRDT)

With Notesaner's Yjs CRDT implementation, there are **no conflicts**. Every edit is a CRDT operation that can be merged with any other edit automatically.

## How Yjs Resolves Conflicts

### Concurrent Insertions

If User A and User B both insert text at the same cursor position simultaneously:

- Yjs uses a deterministic ordering based on client IDs
- Both insertions are preserved — one is placed before the other
- Neither edit is lost

### Concurrent Deletions

If User A deletes text that User B is editing simultaneously:

- User B's insertion wins over User A's deletion for that character
- The deletion applies to all other characters

### Offline Edits

If you edit a note while offline:

1. Your edits are stored locally as Yjs updates
2. When you reconnect, your updates are sent to the server
3. The server merges them with any changes made while you were offline
4. All clients receive the merged state

## When Things Look Unexpected

If the merged result looks unexpected after a simultaneous edit, use [Note History & Recovery](/help/user-guide/notes-folders/history) to inspect recent versions and restore a specific state.
