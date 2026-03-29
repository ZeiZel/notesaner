---
title: Rate Limiting & Pagination
description: Rate limit headers, cursor-based pagination pattern.
---

# Rate Limiting & Pagination

## Rate Limits

| Tier        | Requests per minute               |
| ----------- | --------------------------------- |
| Free        | 60                                |
| Pro         | 300                               |
| Team        | 600                               |
| Self-hosted | Configurable (default: unlimited) |

### Rate Limit Headers

Every response includes:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 247
X-RateLimit-Reset: 1743260400
```

When rate limited, the response is `429 Too Many Requests` with a `Retry-After` header.

## Pagination

List endpoints use cursor-based pagination:

### Request

```bash
GET /api/v1/notes?limit=20&cursor=note_abc123
```

Parameters:

- `limit` — number of items per page (default: 20, max: 100)
- `cursor` — opaque cursor from the previous response's `nextCursor`

### Response

```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "note_xyz789",
    "hasMore": true,
    "total": 143
  }
}
```

When `hasMore` is `false` or `nextCursor` is `null`, you've reached the last page.
