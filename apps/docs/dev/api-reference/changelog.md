---
title: API Changelog
description: Version history and breaking changes for the Notesaner API.
---

# API Changelog

## v1.0.0 (Current)

Initial public API release.

### Endpoints

- `GET /api/v1/notes` — List notes with filtering
- `POST /api/v1/notes` — Create note
- `PATCH /api/v1/notes/:id` — Update note
- `DELETE /api/v1/notes/:id` — Delete note (to trash)
- `GET /api/v1/workspaces` — List workspaces
- `GET /api/v1/search` — Full-text search
- `POST /api/v1/auth/login` — Authenticate
- `POST /api/v1/api-keys` — Generate API key

### WebSocket

- Yjs document sync protocol
- Presence events (join, leave, cursor)
- Comment events

---

_This page is updated with each API release._
