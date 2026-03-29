---
title: Backend Architecture (Clean Architecture)
description: NestJS module structure, service/repository split, CQRS, and Prisma patterns.
---

# Backend Architecture (Clean Architecture)

The backend (`apps/server`) follows Clean Architecture principles with NestJS modules.

## Module Structure

```
apps/server/src/
├── app.module.ts               # Root module
├── modules/
│   ├── auth/                   # Authentication (JWT, SAML, OIDC)
│   ├── users/                  # User management
│   ├── workspaces/             # Workspace CRUD
│   ├── notes/                  # Note CRUD + filesystem sync
│   ├── search/                 # Full-text search
│   ├── plugins/                # Plugin registry and management
│   ├── publish/                # Note publishing
│   ├── api-keys/               # API key management
│   ├── component-overrides/    # UI component overrides
│   └── sync/                   # Yjs WebSocket sync gateway
├── common/
│   ├── guards/                 # Auth guards
│   ├── decorators/             # Custom decorators
│   ├── filters/                # Exception filters
│   ├── interceptors/           # Logging, transform interceptors
│   └── pipes/                  # Validation pipes (Zod)
└── prisma/
    ├── schema.prisma           # Database schema
    └── migrations/             # Migration files
```

## Layer Responsibilities

| Layer          | Responsibility                                          |
| -------------- | ------------------------------------------------------- |
| **Controller** | HTTP routing, request/response DTOs, guards             |
| **Service**    | Business logic, orchestration, event emission           |
| **Repository** | Database access via Prisma (optional extra abstraction) |
| **Module**     | Dependency injection wiring                             |

## DTO Validation

All incoming requests are validated with Zod at the controller level via a custom `ZodValidationPipe`:

```typescript
@Post()
create(@Body(new ZodValidationPipe(CreateNoteDto)) dto: CreateNoteDto) {
  return this.notesService.create(dto);
}
```

## Prisma Patterns

- Single `PrismaService` injectable across all modules
- Repository methods return typed Prisma models or mapped domain objects
- Raw SQL only for full-text search queries

## WebSocket (Yjs Sync)

The `SyncModule` exposes a `@WebSocketGateway()` that handles:

- Room-based document sessions (one room per note)
- Yjs update broadcasting
- Presence tracking (who's online in a note)
