/**
 * Editor flow e2e tests.
 *
 * Verifies the note editor loads, displays demo content, renders the
 * breadcrumb toolbar, and the editor mode toggle works (WYSIWYG, Source,
 * Live Preview, Reading).
 */

import { test, expect } from '@playwright/test';

test.describe('Note Editor', () => {
  const EDITOR_URL = '/workspaces/test-workspace-1/notes/test-note-1';

  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL);
  });

  test('renders the breadcrumb toolbar', async ({ page }) => {
    // The NoteEditorClient renders a breadcrumb navigation
    const breadcrumb = page.locator('nav[aria-label="Note path"]');
    await expect(breadcrumb).toBeVisible();

    // Breadcrumb segments
    await expect(breadcrumb.locator('text=Workspace')).toBeVisible();
    await expect(breadcrumb.locator('text=Untitled note')).toBeVisible();
  });

  test('displays the word count', async ({ page }) => {
    // Word count is shown in the breadcrumb toolbar
    await expect(page.locator('text=words')).toBeVisible();
  });

  test('renders the editor mode toggle toolbar', async ({ page }) => {
    const modeToolbar = page.locator('div[role="toolbar"][aria-label="Editor mode"]');
    await expect(modeToolbar).toBeVisible();
  });

  test('editor mode toggle shows current mode label', async ({ page }) => {
    // Default mode is WYSIWYG
    const modeToolbar = page.locator('div[role="toolbar"][aria-label="Editor mode"]');
    await expect(modeToolbar).toBeVisible();

    // The mode button should display one of the mode labels
    const modeButton = modeToolbar.locator('button').first();
    await expect(modeButton).toBeVisible();
  });

  test('reading mode toggle button exists', async ({ page }) => {
    // There should be a button to toggle reading mode
    const readingButton = page.locator(
      'button[aria-label="Enter reading mode"], button[aria-label="Exit reading mode"]',
    );
    await expect(readingButton).toBeVisible();
  });

  test('clicking reading mode toggle changes layout', async ({ page }) => {
    // Click the reading mode button
    const readingButton = page.locator('button[aria-label="Enter reading mode"]');
    await expect(readingButton).toBeVisible();
    await readingButton.click();

    // In reading mode, the breadcrumb toolbar should be hidden
    // (ReadingModeView has its own toolbar)
    const breadcrumb = page.locator('nav[aria-label="Note path"]');
    await expect(breadcrumb).not.toBeVisible();

    // Exit reading mode button should now be visible
    const exitButton = page.locator('button[aria-label="Exit reading mode"]');
    await expect(exitButton).toBeVisible();
  });

  test('cycling editor mode changes the mode label', async ({ page }) => {
    const modeToolbar = page.locator('div[role="toolbar"][aria-label="Editor mode"]');
    const cycleButton = modeToolbar.locator('button').first();

    // Get the initial title
    const initialTitle = await cycleButton.getAttribute('title');

    // Click to cycle mode
    await cycleButton.click();

    // After clicking, the title should change (different mode)
    await expect(cycleButton).not.toHaveAttribute('title', initialTitle ?? '');
  });

  test('editor surface renders within error boundary', async ({ page }) => {
    // The editor content area should be present (the EditorModeWrapper
    // is wrapped in an ErrorBoundary)
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();

    // Should not show an error boundary fallback
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });

  test('demo markdown content loads', async ({ page }) => {
    // The NoteEditorClient hydrates with DEMO_MARKDOWN which includes
    // "Welcome to Notesaner" heading
    await expect(page.locator('text=Welcome to Notesaner')).toBeVisible({ timeout: 15_000 });
  });
});
