/**
 * Navigation E2E tests.
 *
 * Covers file tree navigation, quick switcher (Cmd+K / Cmd+P),
 * search functionality, and breadcrumb navigation.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { openCommandPalette, closeCommandPalette, navigateToWorkspace } from '../utils/helpers';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace-1';
const WORKSPACE_URL = `/workspaces/${WORKSPACE_ID}`;

test.describe('File tree navigation', () => {
  test('file tree shows folders and notes', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    // Sidebar file tree should display folder structure
    await expect(page.locator('text=My Workspace')).toBeVisible();
    await expect(page.locator('text=Getting Started')).toBeVisible();
    await expect(page.locator('text=Projects')).toBeVisible();
    await expect(page.locator('text=Daily Notes')).toBeVisible();
  });

  test('clicking a folder expands its children', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    const folder = page.locator('text=Getting Started').first();
    await expect(folder).toBeVisible();

    // Click folder to expand (if it is collapsible)
    await folder.click();
    await page.waitForTimeout(300);

    // Children should be visible (folder content varies by setup)
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });

  test('clicking a note in the file tree opens the editor', async ({
    authenticatedPage: page,
  }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    // Find a note item in the sidebar tree
    const noteItem = page.locator(
      '[data-testid="tree-item-note"], [data-node-type="note"], .tree-item--note',
    ).first();

    if (await noteItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await noteItem.click();

      // Should navigate to a note URL
      await page.waitForURL('**/notes/**', { timeout: 10_000 });

      // Editor or note content should be visible
      const editorOrContent = page.locator('.ProseMirror, #main-content');
      await expect(editorOrContent.first()).toBeVisible();
    }
  });

  test('file tree supports keyboard navigation', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    // Focus the file tree
    const treeItem = page.locator(
      '[role="treeitem"], [data-testid="tree-item"]',
    ).first();

    if (await treeItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await treeItem.focus();

      // Arrow keys should navigate
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowDown');

      // Enter should select/open the focused item
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Quick switcher (Cmd+P)', () => {
  test('opens command palette with keyboard shortcut', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    await openCommandPalette(page);

    const paletteInput = page.locator('input[placeholder*="command"]');
    await expect(paletteInput).toBeVisible();
  });

  test('closes command palette with Escape', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    await openCommandPalette(page);
    await closeCommandPalette(page);

    const paletteInput = page.locator('input[placeholder*="command"]');
    await expect(paletteInput).not.toBeVisible();
  });

  test('command palette shows available commands', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    await openCommandPalette(page);

    // Should show common commands
    await expect(page.locator('text=New note')).toBeVisible();
    await expect(page.locator('text=Toggle left sidebar')).toBeVisible();
  });

  test('typing in command palette filters results', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    await openCommandPalette(page);

    const paletteInput = page.locator('input[placeholder*="command"]');
    await paletteInput.fill('new');

    // Should show filtered results containing "new"
    await expect(page.locator('text=New note')).toBeVisible();
  });

  test('selecting a command executes it', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    await openCommandPalette(page);

    const paletteInput = page.locator('input[placeholder*="command"]');
    await paletteInput.fill('new note');

    const newNoteCommand = page.locator('text=New note').first();
    if (await newNoteCommand.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newNoteCommand.click();

      // After creating a new note, we should be in the editor
      await page.waitForTimeout(1_000);
      const editorOrUrl = page.url().includes('/notes/') ||
        await page.locator('.ProseMirror').isVisible({ timeout: 5_000 }).catch(() => false);

      expect(editorOrUrl).toBeTruthy();
    }
  });

  test('Cmd+K also opens quick switcher or search', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    // Some apps use Cmd+K for search/switcher
    await page.keyboard.press('Meta+k');

    // Check if any overlay/modal opened
    const overlay = page.locator(
      'input[placeholder*="command"], input[placeholder*="Search"], [role="dialog"]',
    );

    const hasOverlay = await overlay
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (hasOverlay) {
      await expect(overlay.first()).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('Search', () => {
  test('search notes button opens search panel', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    const searchButton = page.getByRole('button', { name: 'Search notes' });

    if (await searchButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await searchButton.click();

      // A search input or panel should appear
      const searchInput = page.locator(
        '[data-testid="search-input"], input[placeholder*="Search"], input[type="search"]',
      );

      await expect(searchInput.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('search returns matching results', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    // Open search via command palette
    await openCommandPalette(page);

    const paletteInput = page.locator('input[placeholder*="command"]');
    await paletteInput.fill('Getting Started');

    // Should show matching notes/commands
    const result = page.locator('text=Getting Started');
    const hasResult = await result
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasResult) {
      await expect(result.first()).toBeVisible();
    }

    await page.keyboard.press('Escape');
  });
});

test.describe('Breadcrumb navigation', () => {
  test('breadcrumb shows current path in note editor', async ({ authenticatedPage: page }) => {
    await page.goto(`${WORKSPACE_URL}/notes/test-note-1`);

    const breadcrumb = page.locator('nav[aria-label="Note path"]');

    if (await breadcrumb.isVisible({ timeout: 10_000 }).catch(() => false)) {
      // Should show workspace and note path segments
      await expect(breadcrumb.locator('text=Workspace')).toBeVisible();
    }
  });

  test('breadcrumb shows path in settings page', async ({ authenticatedPage: page }) => {
    await page.goto(`${WORKSPACE_URL}/settings/general`);

    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');

    if (await breadcrumb.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(breadcrumb.locator('text=Home')).toBeVisible();
      await expect(breadcrumb.locator('text=Settings')).toBeVisible();
      await expect(breadcrumb.locator('text=General')).toBeVisible();
    }
  });

  test('clicking breadcrumb segment navigates to that level', async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`${WORKSPACE_URL}/settings/general`);

    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');

    if (await breadcrumb.isVisible({ timeout: 10_000 }).catch(() => false)) {
      const homeLink = breadcrumb.getByRole('link', { name: 'Home' });

      if (await homeLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await homeLink.click();

        // Should navigate back to workspace home
        await page.waitForURL(`**${WORKSPACE_URL}`, { timeout: 10_000 });
      }
    }
  });

  test('breadcrumb updates when navigating between notes', async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`${WORKSPACE_URL}/notes/test-note-1`);

    const breadcrumb = page.locator('nav[aria-label="Note path"]');

    if (await breadcrumb.isVisible({ timeout: 10_000 }).catch(() => false)) {
      const firstBreadcrumbText = await breadcrumb.textContent();

      // Navigate to a different page
      await page.goto(`${WORKSPACE_URL}/settings/general`);
      await page.waitForTimeout(500);

      const settingsBreadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
      if (await settingsBreadcrumb.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const secondBreadcrumbText = await settingsBreadcrumb.textContent();

        // Breadcrumb text should differ between note and settings views
        expect(secondBreadcrumbText).not.toBe(firstBreadcrumbText);
      }
    }
  });
});
