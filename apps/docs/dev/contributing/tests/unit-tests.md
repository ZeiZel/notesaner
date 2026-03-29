---
title: Unit Tests (Vitest)
description: Running and writing unit tests with Vitest.
---

# Unit Tests (Vitest)

## Running Tests

```bash
# Run all tests
pnpm nx run-many -t test

# Run tests for a specific project
pnpm nx test web
pnpm nx test server

# Run in watch mode
pnpm nx test server --watch

# Run with coverage
pnpm nx test server --coverage

# Run tests matching a pattern
pnpm nx test server --testNamePattern="NotesService"
```

## Configuration

Each project has a `vitest.config.ts`. The root configuration is in `vitest.workspace.ts`.

## Writing Tests

See [Testing Guidelines](/docs/contributing/standards/testing) for best practices.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const date = new Date('2026-03-29T14:30:00Z');
    expect(formatDate(date)).toBe('2026-03-29');
  });
});
```
