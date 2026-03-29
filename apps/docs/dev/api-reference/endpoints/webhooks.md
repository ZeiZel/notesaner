---
title: Webhooks
description: Register and manage webhooks for Notesaner events.
---

# Webhooks

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

Webhooks allow you to receive HTTP POST notifications when events occur in your workspace.

## Supported Events

| Event            | Description                     |
| ---------------- | ------------------------------- |
| `note.created`   | A new note was created          |
| `note.updated`   | A note was modified             |
| `note.deleted`   | A note was moved to trash       |
| `member.invited` | A new member was invited        |
| `member.joined`  | A member accepted an invitation |

## Register a Webhook

```
POST /api/v1/workspaces/:workspaceId/webhooks
```

Body:

```json
{
  "url": "https://your-server.com/webhook",
  "events": ["note.created", "note.updated"],
  "secret": "your-webhook-secret"
}
```

## Webhook Payload

```json
{
  "event": "note.created",
  "timestamp": "2026-03-29T14:30:00Z",
  "workspaceId": "ws_abc123",
  "data": {
    "noteId": "note_xyz",
    "title": "New Note",
    "createdBy": "user_123"
  }
}
```

## Verifying Signatures

Payloads are signed using HMAC-SHA256 with your webhook secret. Verify the `X-Notesaner-Signature` header.
