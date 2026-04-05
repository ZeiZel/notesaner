/**
 * Shared helper utilities for Playwright E2E tests.
 *
 * Provides reusable functions for common editor and UI interactions.
 */

import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EDITOR_SELECTOR = '.ProseMirror';
const EDITOR_CONTENT_EDITABLE = `${EDITOR_SELECTOR}[contenteditable="true"]`;
const DEFAULT_WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace-1';

// ---------------------------------------------------------------------------
// Editor helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the TipTap/ProseMirror editor to be mounted and interactive.
 * Returns the editor locator.
 */
export async function waitForEditor(page: Page, timeout = 15_000) {
  const editor = page.locator(EDITOR_SELECTOR);
  await editor.waitFor({ state: 'visible', timeout });
  return editor;
}

/**
 * Create a new note using the UI (via sidebar or workspace home button).
 * Waits for the editor to appear after creation.
 */
export async function createNoteViaUI(page: Page, title: string) {
  // Try the "New note" button in the workspace home or sidebar
  const newNoteButton = page.getByRole('button', { name: 'New note' });
  await newNoteButton.first().click();

  // Wait for the editor to load
  await waitForEditor(page);

  // If the note title input is visible, fill it
  const titleInput = page.locator(
    'input[data-testid="note-title"], input[aria-label="Note title"], [contenteditable][data-placeholder*="title" i]',
  );

  if (await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await titleInput.fill(title);
  } else {
    // Some editors embed the title in the first heading — type it directly
    const editor = page.locator(EDITOR_CONTENT_EDITABLE);
    await editor.click();
    await page.keyboard.type(title);
    await page.keyboard.press('Enter');
  }
}

/**
 * Focus the editor and type the given text.
 */
export async function typeInEditor(page: Page, text: string) {
  const editor = page.locator(EDITOR_CONTENT_EDITABLE);
  await editor.click();
  await page.keyboard.type(text, { delay: 20 });
}

/**
 * Get the current text content of the ProseMirror editor.
 */
export async function getEditorContent(page: Page): Promise<string> {
  const editor = page.locator(EDITOR_SELECTOR);
  return editor.innerText();
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to a specific note in a workspace.
 */
export async function navigateToNote(
  page: Page,
  noteId: string,
  workspaceId: string = DEFAULT_WORKSPACE_ID,
) {
  await page.goto(`/workspaces/${workspaceId}/notes/${noteId}`);
  await waitForEditor(page);
}

/**
 * Navigate to the workspace home page.
 */
export async function navigateToWorkspace(
  page: Page,
  workspaceId: string = DEFAULT_WORKSPACE_ID,
) {
  await page.goto(`/workspaces/${workspaceId}`);
  await page.locator('#main-content').waitFor({ state: 'visible' });
}

/**
 * Open the command palette via keyboard shortcut.
 */
export async function openCommandPalette(page: Page) {
  await page.keyboard.press('Meta+p');
  await page
    .locator('input[placeholder*="command"]')
    .waitFor({ state: 'visible', timeout: 5_000 });
}

/**
 * Close the command palette via Escape.
 */
export async function closeCommandPalette(page: Page) {
  await page.keyboard.press('Escape');
  await page
    .locator('input[placeholder*="command"]')
    .waitFor({ state: 'hidden', timeout: 3_000 });
}

// ---------------------------------------------------------------------------
// Sidebar helpers
// ---------------------------------------------------------------------------

/**
 * Toggle the left sidebar open/closed.
 */
export async function toggleLeftSidebar(page: Page) {
  const button = page.getByLabel('Open file explorer').or(
    page.getByLabel('Toggle left sidebar'),
  );
  await button.first().click();
}

/**
 * Toggle the right sidebar open/closed.
 */
export async function toggleRightSidebar(page: Page) {
  const button = page.getByLabel('Toggle right sidebar');
  await button.click();
}

// ---------------------------------------------------------------------------
// Wait helpers
// ---------------------------------------------------------------------------

/**
 * Wait for network idle — useful after actions that trigger API calls.
 */
export async function waitForNetworkIdle(page: Page, timeout = 5_000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for a toast / notification message to appear.
 */
export async function waitForToast(page: Page, textMatch: string | RegExp) {
  const toast = page.locator('.ant-message, [role="alert"], [role="status"]');
  if (typeof textMatch === 'string') {
    await toast.filter({ hasText: textMatch }).waitFor({ state: 'visible', timeout: 5_000 });
  } else {
    await toast.filter({ hasText: textMatch }).waitFor({ state: 'visible', timeout: 5_000 });
  }
}
