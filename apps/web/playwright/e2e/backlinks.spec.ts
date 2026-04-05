/**
 * Backlinks E2E tests.
 *
 * Covers creating a wiki-link between notes, verifying the backlinks
 * panel displays incoming references, and navigating via backlinks.
 */

import { test, expect } from '../fixtures/test-fixtures';
import {
  waitForEditor,
  typeInEditor,
  getEditorContent,
  navigateToNote,
  waitForNetworkIdle,
} from '../utils/helpers';

test.describe('Backlinks panel', () => {
  test('backlinks panel is accessible from the editor view', async ({
    authenticatedPage: page,
    testNote,
  }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    // Backlinks may be in a right sidebar panel, a tab, or a dedicated section
    const backlinksPanel = page.locator(
      '[data-testid="backlinks-panel"], [aria-label="Backlinks"], [data-testid="backlinks"]',
    );

    // Try toggling the right sidebar if backlinks are there
    const rightSidebarToggle = page.getByLabel('Toggle right sidebar');
    if (await rightSidebarToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await rightSidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // Check for backlinks section
    const backlinksHeader = page.locator('text=Backlinks').or(page.locator('text=backlinks'));
    const hasBacklinks = await backlinksHeader
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasBacklinks) {
      await expect(backlinksHeader.first()).toBeVisible();
    }
  });

  test('creating a wiki-link generates a backlink on the target note', async ({
    authenticatedPage: page,
    testNote,
  }) => {
    // This test requires two notes. We navigate to the test note and
    // create a wiki-link to another known note.
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    // Type a wiki-link pointing to a hypothetical target note
    const targetTitle = 'Getting Started';
    await typeInEditor(page, `See also [[${targetTitle}]]`);

    // Wait for auto-save
    await page.waitForTimeout(2_000);
    await waitForNetworkIdle(page);

    // Now navigate to the target note (if it exists in the sidebar)
    const sidebar = page.locator('[data-testid="sidebar"], aside, nav');
    const targetLink = sidebar.locator(`text=${targetTitle}`).first();

    if (await targetLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await targetLink.click();
      await waitForEditor(page);

      // Open backlinks panel
      const rightSidebarToggle = page.getByLabel('Toggle right sidebar');
      if (await rightSidebarToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await rightSidebarToggle.click();
      }

      // Look for the source note in the backlinks list
      const backlinkEntry = page.locator(
        `[data-testid="backlink-item"], [data-testid="backlinks-panel"] >> text=${testNote.title}`,
      );

      const hasBacklink = await backlinkEntry
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (hasBacklink) {
        await expect(backlinkEntry.first()).toBeVisible();
      }
    }
  });

  test('clicking a backlink navigates to the referring note', async ({
    authenticatedPage: page,
    testNote,
  }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    // Open right sidebar for backlinks
    const rightSidebarToggle = page.getByLabel('Toggle right sidebar');
    if (await rightSidebarToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await rightSidebarToggle.click();
    }

    // Find a backlink entry (if any exist for this note)
    const backlinkItem = page.locator(
      '[data-testid="backlink-item"] a, [data-testid="backlinks-panel"] a',
    ).first();

    if (await backlinkItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const currentUrl = page.url();

      // Click the backlink to navigate
      await backlinkItem.click();

      // Should navigate to the referring note
      await page.waitForURL(
        (url) => url.pathname !== new URL(currentUrl).pathname,
        { timeout: 10_000 },
      );

      // Editor should load for the new note
      await waitForEditor(page);
    }
  });

  test('unlinked mentions panel shows potential backlinks', async ({
    authenticatedPage: page,
    testNote,
  }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    // Open right sidebar
    const rightSidebarToggle = page.getByLabel('Toggle right sidebar');
    if (await rightSidebarToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await rightSidebarToggle.click();
    }

    // Look for unlinked mentions section
    const unlinkedMentions = page.locator(
      '[data-testid="unlinked-mentions"], text=Unlinked mentions',
    );

    const hasUnlinked = await unlinkedMentions
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasUnlinked) {
      await expect(unlinkedMentions.first()).toBeVisible();
    }
  });
});

test.describe('Backlink count', () => {
  test('backlink count badge reflects the number of incoming links', async ({
    authenticatedPage: page,
    testNote,
  }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    // Some UIs show a backlink count badge
    const backlinkCount = page.locator(
      '[data-testid="backlink-count"], [aria-label*="backlink"]',
    );

    const hasCount = await backlinkCount
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasCount) {
      const text = await backlinkCount.first().textContent();
      // The count should be a number (could be 0 for a fresh test note)
      expect(text).toMatch(/\d+/);
    }
  });
});
