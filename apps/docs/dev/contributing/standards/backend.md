---
title: Backend Standards (NestJS Clean Architecture)
description: Module structure, service/repository split, Prisma patterns, and testing.
---

# Backend Standards (NestJS Clean Architecture)

## Module Structure

Every feature module follows this structure:

```
modules/notes/
├── notes.module.ts          # DI wiring
├── notes.controller.ts      # HTTP routing + DTOs
├── notes.service.ts         # Business logic
├── notes.repository.ts      # (optional) DB abstraction
├── dto/
│   ├── create-note.dto.ts
│   └── update-note.dto.ts
└── __tests__/
    └── notes.service.test.ts
```

## Controller Rules

- Controllers handle HTTP concerns only (routing, status codes, auth guards)
- No business logic in controllers
- Validate input with `ZodValidationPipe`
- Return DTOs, not raw Prisma models

```typescript
@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateNoteSchema)) dto: CreateNoteDto,
    @CurrentUser() user: User,
  ) {
    return this.notesService.create(dto, user.id);
  }
}
```

## Service Rules

- All business logic lives in services
- Services are where transactions happen
- Services emit events via NestJS EventEmitter

## Prisma Rules

- Use the injected `PrismaService` — never instantiate `PrismaClient` directly
- Use Prisma's type-safe query builder — no raw SQL except for FTS
- Wrap multi-step operations in `prisma.$transaction()`

## Error Handling

Throw NestJS built-in exceptions:

```typescript
throw new NotFoundException(`Note ${id} not found`);
throw new ForbiddenException('Insufficient permissions');
throw new ConflictException('Note already exists');
```
