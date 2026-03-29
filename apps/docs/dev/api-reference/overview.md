---
title: REST API Overview
description: Base URL, versioning strategy, content types, and authentication header.
---

# REST API Overview

The Notesaner REST API provides programmatic access to notes, workspaces, users, and more.

## Base URL

```
https://notesaner.example.com/api/v1
```

For self-hosted instances, replace `notesaner.example.com` with your domain.

## Versioning

The API is versioned via the URL path (`/v1`, `/v2`). Breaking changes are only introduced in new major versions. The current stable version is **v1**.

## Content Types

All requests and responses use JSON:

```
Content-Type: application/json
Accept: application/json
```

## Authentication

All API endpoints require authentication. See [Authentication](/docs/api-reference/authentication).

```
Authorization: Bearer <jwt_token>
```

## Rate Limiting

See [Rate Limiting & Pagination](/docs/api-reference/rate-limiting) for limit headers and pagination patterns.

## OpenAPI Specification

An OpenAPI 3.0 specification is auto-generated from the NestJS controllers and available at:

```
GET /api/docs              # Swagger UI
GET /api/docs-json         # Raw OpenAPI JSON
GET /api/docs-yaml         # Raw OpenAPI YAML
```

## Error Format

All errors follow a consistent format:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Note with ID 'abc123' not found",
  "errorCode": "NOTE_NOT_FOUND"
}
```

See [Error Codes Reference](/docs/api-reference/error-codes) for the complete list.
