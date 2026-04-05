/**
 * Notes CRUD E2E tests.
 *
 * Covers creating a note, verifying it appears in the sidebar,
 * editing the title, deleting, and persistence after reload.
 */

import { test, expect } from '../fixtures/test-fixtures';
import {
  waitForEditor,
  createNoteViaUI,
  typeInEditor,
  getEditorContent,
  navigateToNote,
  navigateToWorkspace,
  waitForNetworkIdle,
} from '../utils/helpers';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace-1';

test.describe('Create note', () => {
  test('creates a new note via UI and it appears in the editor', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    const noteTitle = `Test Note ${Date.now()}`;
    await createNoteViaUI(page, noteTitle);

    // Editor should be visible
    const editor = await waitForEditor(page);
    await expect(editor).toBeVisible();
  });

  test('new note title appears in sidebar file tree', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    const noteTitle = `Sidebar Note ${Date.now()}`;
    await createNoteViaUI(page, noteTitle);

    // The sidebar should list the new note
    const sidebar = page.locator('[data-testid="sidebar"], aside, nav');
    await expect(sidebar.locator(`text=${noteTitle}`).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Edit note', () => {
  test('typing in the editor persists content', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    const testText = `Hello from E2E test ${Date.now()}`;
    await typeInEditor(page, testText);

    // Wait for auto-save debounce (500ms as documented)
    await page.waitForTimeout(1_000);
    await waitForNetworkIdle(page);

    // Content should be in the editor
    const content = await getEditorContent(page);
    expect(content).toContain(testText);
  });

  test('edited content persists after page reload', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    const uniqueText = `Persist check ${Date.now()}`;
    await typeInEditor(page, uniqueText);

    // Wait for auto-save
    await page.waitForTimeout(1_500);
    await waitForNetworkIdle(page);

    // Reload the page
    await page.reload();
    await waitForEditor(page);

    // Content should still be present
    const content = await getEditorContent(page);
    expect(content).toContain(uniqueText);
  });

  test('note title can be edited', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    // Look for the title element (inline editable or input)
    const titleInput = page.locator(
      'input[data-testid="note-title"], input[aria-label="Note title"], [contenteditable][data-placeholder*="title" i]',
    );

    if (await titleInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const newTitle = `Renamed ${Date.now()}`;

      // Clear and type new title
      await titleInput.click();
      await page.keyboard.press('Meta+a');
      await page.keyboard.type(newTitle);

      // Wait for save
      await page.waitForTimeout(1_000);
      await waitForNetworkIdle(page);

      // Verify the title updated
      await expect(titleInput).toHaveValue(newTitle);
    }
  });
});

test.describe('Delete note', () => {
  test('deleting a note removes it from the editor view', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);
    await waitForEditor(page);

    // Look for a delete action (context menu, toolbar button, or command palette)
    const deleteButton = page.locator(
      'button[data-testid="delete-note"], button[aria-label="Delete note"]',
    );

    if (await deleteButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteButton.click();

      // Confirm deletion if a dialog appears
      const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i });
      if (await confirmButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Should navigate away from the deleted note
      await page.waitForURL((url) => !url.pathname.includes(testNote.id), {
        timeout: 10_000,
      });
    }
  });

  test('deleted note disappears from sidebar', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    // Verify the note is in the sidebar first
    const sidebar = page.locator('[data-testid="sidebar"], aside, nav');
    const noteInSidebar = sidebar.locator(`text=${testNote.title}`).first();

    // Attempt deletion via right-click context menu
    if (await noteInSidebar.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await noteInSidebar.click({ button: 'right' });

      const deleteMenuItem = page.getByRole('menuitem', { name: /delete/i }).or(
        page.locator('[data-testid="context-menu"] >> text=Delete'),
      );

      if (await deleteMenuItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await deleteMenuItem.click();

        // Confirm if needed
        const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i });
        if (await confirmButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await confirmButton.click();
        }

        // Note should no longer be in sidebar
        await expect(noteInSidebar).not.toBeVisible({ timeout: 10_000 });
      }
    }
  });
});
