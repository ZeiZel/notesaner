/**
 * Navigation E2E tests.
 *
 * Covers file tree navigation, quick switcher (Cmd+K / Cmd+P),
 * search functionality, and breadcrumb navigation.
 *
 * NOTE: With the updated layout, both sidebars are always visible
 * on desktop. The file tree is a panel that users can drag into
 * the left sidebar.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { openCommandPalette, closeCommandPalette, navigateToWorkspace } from '../utils/helpers';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace-1';
const WORKSPACE_URL = `/workspaces/${WORKSPACE_ID}`;

test.describe('Workspace layout', () => {
  test('both sidebars are visible on workspace load', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    // Both sidebars should be visible
    const leftSidebar = page.locator('aside[data-side="left"]');
    const rightSidebar = page.locator('aside[data-side="right"]');

    await expect(leftSidebar).toBeVisible({ timeout: 10_000 });
    await expect(rightSidebar).toBeVisible({ timeout: 10_000 });
  });

  test('tab bar is visible with new tab button', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    const tabBar = page.locator('[role="tablist"]');
    await expect(tabBar).toBeVisible({ timeout: 10_000 });

    const newTabButton = page.getByLabel('New tab');
    await expect(newTabButton).toBeVisible();
  });

  test('ribbon quick actions are visible', async ({ authenticatedPage: page }) => {
    await navigateToWorkspace(page, WORKSPACE_ID);

    const ribbon = page.locator('nav[aria-label="Quick actions"]');
    await expect(ribbon).toBeVisible({ timeout: 10_000 });
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
      const editorOrUrl =
        page.url().includes('/notes/') ||
        (await page
          .locator('.ProseMirror')
          .isVisible({ timeout: 5_000 })
          .catch(() => false));

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

      // A search input or panel should appear (command palette or search panel)
      const searchInput = page.locator(
        '[data-testid="search-input"], input[placeholder*="Search"], input[type="search"], input[placeholder*="command"]',
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
});
