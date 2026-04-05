/**
 * Shared Playwright fixtures for E2E tests.
 *
 * Provides `authenticatedPage` (logged-in browser context) and
 * `testNote` (API-created note with automatic cleanup).
 */

import { test as base, type Page, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestNote {
  id: string;
  title: string;
  workspaceId: string;
}

interface AuthCredentials {
  email: string;
  password: string;
}

interface TestFixtures {
  /** A Page already authenticated via API login. */
  authenticatedPage: Page;
  /** A note created via API before the test, deleted after. */
  testNote: TestNote;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CREDENTIALS: AuthCredentials = {
  email: process.env.E2E_USER_EMAIL ?? 'e2e@notesaner.local',
  password: process.env.E2E_USER_PASSWORD ?? 'TestPassword123!',
};

const DEFAULT_WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace-1';
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Authenticate via API and return the auth cookies/token from the response.
 */
async function loginViaApi(
  context: BrowserContext,
  credentials: AuthCredentials = DEFAULT_CREDENTIALS,
): Promise<void> {
  const response = await context.request.post(`${BASE_URL}/api/auth/login`, {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `API login failed (${response.status()}): ${await response.text()}`,
    );
  }

  // The server sets httpOnly cookies on the response.
  // Playwright automatically stores them on the context.
}

/**
 * Create a note via API and return its metadata.
 */
async function createNoteViaApi(
  context: BrowserContext,
  workspaceId: string = DEFAULT_WORKSPACE_ID,
  title: string = `E2E Test Note ${Date.now()}`,
): Promise<TestNote> {
  const response = await context.request.post(
    `${BASE_URL}/api/workspaces/${workspaceId}/notes`,
    {
      data: { title, content: '' },
    },
  );

  if (!response.ok()) {
    throw new Error(
      `Failed to create note (${response.status()}): ${await response.text()}`,
    );
  }

  const data = (await response.json()) as { id: string; title: string };
  return { id: data.id, title: data.title, workspaceId };
}

/**
 * Delete a note via API.
 */
async function deleteNoteViaApi(
  context: BrowserContext,
  note: TestNote,
): Promise<void> {
  const response = await context.request.delete(
    `${BASE_URL}/api/workspaces/${note.workspaceId}/notes/${note.id}`,
  );

  // Tolerate 404 — note may have been deleted by the test itself.
  if (!response.ok() && response.status() !== 404) {
    console.warn(
      `Cleanup: failed to delete note ${note.id} (${response.status()})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext();

    await loginViaApi(context);

    const page = await context.newPage();
    await use(page);

    await context.close();
  },

  testNote: async ({ browser }, use) => {
    const context = await browser.newContext();

    await loginViaApi(context);

    const note = await createNoteViaApi(context);

    await use(note);

    // Cleanup
    await deleteNoteViaApi(context, note);
    await context.close();
  },
});

export { expect } from '@playwright/test';
export type { TestNote, AuthCredentials };
