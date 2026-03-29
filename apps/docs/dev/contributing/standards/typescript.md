---
title: TypeScript Guidelines
description: TypeScript strict mode, Zod at boundaries, barrel exports, and naming conventions.
---

# TypeScript Guidelines

Notesaner uses TypeScript in strict mode across the entire monorepo.

## Strict Mode

All projects have `"strict": true` in their tsconfig. This enables:

- `strictNullChecks`
- `noImplicitAny`
- `strictFunctionTypes`
- `strictBindCallApply`

## Zod at System Boundaries

Use Zod for runtime validation at:

- API request bodies (NestJS controllers)
- External API responses
- Configuration parsing
- Environment variable validation

```typescript
import { z } from 'zod';

const CreateNoteSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().optional().default(''),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});

type CreateNoteDto = z.infer<typeof CreateNoteSchema>;
```

## Barrel Exports

All libs and packages export from a single `index.ts`:

```typescript
// libs/contracts/src/index.ts
export * from './notes';
export * from './workspaces';
export * from './auth';
```

Consumers import from the package root:

```typescript
import { NoteDto, CreateNoteDto } from '@notesaner/contracts';
```

## Naming Conventions

| Thing      | Convention  | Example            |
| ---------- | ----------- | ------------------ |
| Files      | kebab-case  | `note-service.ts`  |
| Classes    | PascalCase  | `NoteService`      |
| Interfaces | PascalCase  | `NoteDto`          |
| Functions  | camelCase   | `createNote()`     |
| Constants  | UPPER_SNAKE | `MAX_NOTE_SIZE`    |
| Types      | PascalCase  | `NoteStatus`       |
| Enums      | PascalCase  | `NoteStatus.Draft` |

## No `any`

Never use `any`. Use:

- `unknown` for truly unknown types, then narrow
- `Record<string, unknown>` for dynamic objects
- Generic types for reusable containers
