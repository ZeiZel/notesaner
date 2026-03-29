---
title: Authentication
description: Bearer token (JWT) and API key authentication.
---

# API Authentication

## Bearer Token (JWT)

Obtain a JWT by logging in:

```bash
curl -X POST https://notesaner.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourpassword"}'
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "expiresIn": 604800
}
```

Use the access token in the `Authorization` header:

```bash
curl https://notesaner.example.com/api/v1/notes \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## API Keys

API keys are for server-to-server integrations (no expiry, can be revoked).

### Generating an API Key

```bash
curl -X POST https://notesaner.example.com/api/v1/api-keys \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Integration", "workspaceId": "ws_123"}'
```

Response:

```json
{
  "id": "key_abc123",
  "name": "My Integration",
  "key": "nsk_live_abc123...",
  "createdAt": "2026-03-29T14:30:00Z"
}
```

:::warning
The API key is only shown once at creation. Store it securely.
:::

Use API keys the same way as JWT tokens:

```
Authorization: Bearer nsk_live_abc123...
```
