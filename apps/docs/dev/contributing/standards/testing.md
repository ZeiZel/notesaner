---
title: Testing Guidelines
description: Vitest unit tests and Playwright E2E tests — what to test and how.
---

# Testing Guidelines

## Testing Stack

| Tool                      | Use                        |
| ------------------------- | -------------------------- |
| **Vitest**                | Unit and integration tests |
| **Playwright**            | End-to-end tests           |
| **React Testing Library** | Component tests            |
| **Supertest**             | API endpoint tests         |

## What to Test

### Always Test

- Service business logic
- Utility functions
- API endpoints (with Supertest)
- Critical user flows (E2E with Playwright)

### Test When Warranted

- Complex component logic
- Zustand store reducers
- Hooks with complex behavior

### Don't Test

- Trivial getter/setter methods
- Framework wiring (NestJS modules, Prisma schema)
- Third-party library behavior

## Test Structure

```typescript
describe('NotesService', () => {
  let service: NotesService;

  beforeEach(async () => {
    // Setup
  });

  describe('create', () => {
    it('should create a note and return the created entity', async () => {
      // Arrange
      const dto: CreateNoteDto = { title: 'Test', content: '# Test' };

      // Act
      const result = await service.create(dto, 'user_123');

      // Assert
      expect(result.title).toBe('Test');
      expect(result.id).toBeDefined();
    });

    it('should throw ConflictException if title already exists', async () => {
      // ...
    });
  });
});
```

## Coverage Requirements

- Service layer: 80%+ coverage
- Controller layer: 70%+ coverage
- Utility functions: 90%+ coverage
