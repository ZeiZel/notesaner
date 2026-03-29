---
title: E2E Tests (Playwright)
description: Running and writing end-to-end tests with Playwright.
---

# E2E Tests (Playwright)

## Running E2E Tests

```bash
# Run all E2E tests
pnpm nx e2e web-e2e

# Run in headed mode (shows browser)
pnpm nx e2e web-e2e --headed

# Run a specific test file
pnpm nx e2e web-e2e --grep "note creation"

# Update snapshots
pnpm nx e2e web-e2e --update-snapshots
```

## Configuration

Playwright config is in `apps/web/playwright.config.ts`.

## Test Location

E2E tests are in `apps/web/playwright/`:

```
apps/web/playwright/
├── auth/
│   └── login.spec.ts
├── notes/
│   ├── create.spec.ts
│   └── editor.spec.ts
├── collaboration/
│   └── realtime.spec.ts
└── fixtures/
    └── auth.fixture.ts
```

## Writing Tests

```typescript
import { test, expect } from '@playwright/test';

test('creates a new note', async ({ page }) => {
  await page.goto('/workspace');

  // Create note
  await page.keyboard.press('Meta+n');
  await page.fill('[data-testid="note-title"]', 'My Test Note');

  // Verify
  await expect(page.locator('[data-testid="note-title"]')).toHaveValue('My Test Note');
  await expect(page.locator('.sidebar-note-item')).toContainText('My Test Note');
});
```
