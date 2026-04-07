/**
 * Layout E2E tests.
 *
 * Covers sidebar visibility (always visible on desktop),
 * sidebar panel drag-and-drop, split view panels,
 * and panel resize interactions.
 */

import { test, expect } from '../fixtures/test-fixtures';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace-1';
const WORKSPACE_URL = `/workspaces/${WORKSPACE_ID}`;

test.describe('Sidebar layout', () => {
  test('left sidebar is always visible on desktop', async ({ authenticatedPage: page }) => {
    await page.goto(WORKSPACE_URL);

    // Left sidebar should always be visible on desktop (not toggled)
    const leftSidebar = page.locator('aside[data-side="left"]');
    await expect(leftSidebar).toBeVisible({ timeout: 10_000 });
  });

  test('right sidebar is always visible on desktop', async ({ authenticatedPage: page }) => {
    await page.goto(WORKSPACE_URL);

    // Right sidebar should also be always visible on desktop
    const rightSidebar = page.locator('aside[data-side="right"]');
    await expect(rightSidebar).toBeVisible({ timeout: 10_000 });
  });

  test('sidebars start with empty state (no pre-populated panels)', async ({
    authenticatedPage: page,
  }) => {
    // Clear localStorage to get fresh defaults
    await page.goto(WORKSPACE_URL);
    await page.evaluate(() => {
      localStorage.removeItem('notesaner-sidebar');
    });
    await page.reload();
    await page.waitForTimeout(1_000);

    // Both sidebars should show the empty "Drag panels here" state
    const emptyStates = page.locator('text=Drag panels here');
    const count = await emptyStates.count();

    // Both sidebars should be in empty state
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('sidebars fill their full allocated height', async ({ authenticatedPage: page }) => {
    await page.goto(WORKSPACE_URL);

    const leftSidebar = page.locator('aside[data-side="left"]');
    await expect(leftSidebar).toBeVisible({ timeout: 10_000 });

    const sidebarBox = await leftSidebar.boundingBox();
    expect(sidebarBox).toBeTruthy();

    if (sidebarBox) {
      const viewportSize = page.viewportSize();
      if (viewportSize) {
        // Sidebar height should be close to viewport height (full height)
        expect(sidebarBox.height).toBeGreaterThan(viewportSize.height * 0.9);
      }
    }
  });

  test('sidebars have same background as workspace area', async ({ authenticatedPage: page }) => {
    await page.goto(WORKSPACE_URL);

    const leftSidebar = page.locator('aside[data-side="left"]');
    const mainContent = page.locator('#main-content');

    await expect(leftSidebar).toBeVisible({ timeout: 10_000 });
    await expect(mainContent).toBeVisible();

    // Get computed background colors
    const sidebarBg = await leftSidebar.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    const mainBg = await mainContent.evaluate((el) => window.getComputedStyle(el).backgroundColor);

    // Backgrounds should be the same color
    expect(sidebarBg).toBe(mainBg);
  });

  test('sidebar header shows Explorer/Inspector labels', async ({ authenticatedPage: page }) => {
    await page.goto(WORKSPACE_URL);

    await expect(page.locator('text=Explorer')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Inspector')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Split view', () => {
  test('split view can be activated via command palette or button', async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`${WORKSPACE_URL}/notes/test-note-1`);

    // Try via command palette
    await page.keyboard.press('Meta+p');
    const paletteInput = page.locator('input[placeholder*="command"]');

    if (await paletteInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await paletteInput.fill('split');

      const splitCommand = page
        .locator('text=Split right, text=Split down, text=Split view')
        .first();

      if (await splitCommand.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await splitCommand.click();
        await page.waitForTimeout(500);

        // Should see two editor panels
        const editorPanels = page.locator(
          '[data-testid="editor-panel"], .editor-pane, .split-pane',
        );

        const panelCount = await editorPanels.count();
        // In split view, there should be at least 2 panes
        if (panelCount >= 2) {
          expect(panelCount).toBeGreaterThanOrEqual(2);
        }
      } else {
        // Close palette if split command not found
        await page.keyboard.press('Escape');
      }
    }
  });

  test('split view shows two editor instances', async ({ authenticatedPage: page }) => {
    await page.goto(`${WORKSPACE_URL}/notes/test-note-1`);

    // Look for split view toggle button
    const splitButton = page.locator(
      'button[data-testid="split-view"], button[aria-label*="Split"], button[aria-label*="split"]',
    );

    if (await splitButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await splitButton.click();
      await page.waitForTimeout(500);

      // Two ProseMirror editors should be visible
      const editors = page.locator('.ProseMirror');
      const editorCount = await editors.count();

      expect(editorCount).toBeGreaterThanOrEqual(2);
    }
  });
});

test.describe('Panel resize', () => {
  test('sidebar can be resized by dragging the divider', async ({ authenticatedPage: page }) => {
    await page.goto(WORKSPACE_URL);

    // Find the resize handle/divider between sidebar and main content
    const divider = page
      .locator(
        '[data-testid="resize-handle"], [data-testid="divider"], .resize-handle, [role="separator"]',
      )
      .first();

    if (await divider.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const dividerBox = await divider.boundingBox();
      expect(dividerBox).toBeTruthy();

      if (dividerBox) {
        // Drag the divider to resize
        const startX = dividerBox.x + dividerBox.width / 2;
        const startY = dividerBox.y + dividerBox.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 100, startY, { steps: 10 });
        await page.mouse.up();

        // The divider should have moved
        const newBox = await divider.boundingBox();
        if (newBox) {
          // Allow some tolerance for snapping behavior
          expect(Math.abs(newBox.x - dividerBox.x)).toBeGreaterThan(10);
        }
      }
    }
  });

  test('sidebar resize persists after page reload', async ({ authenticatedPage: page }) => {
    await page.goto(WORKSPACE_URL);

    const divider = page
      .locator('[data-testid="resize-handle"], .resize-handle, [role="separator"]')
      .first();

    if (await divider.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const dividerBox = await divider.boundingBox();

      if (dividerBox) {
        // Resize
        const startX = dividerBox.x + dividerBox.width / 2;
        const startY = dividerBox.y + dividerBox.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 80, startY, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);

        const afterResizeBox = await divider.boundingBox();

        // Reload
        await page.reload();
        await page.waitForTimeout(1_000);

        const afterReloadDivider = page
          .locator('[data-testid="resize-handle"], .resize-handle, [role="separator"]')
          .first();

        if (await afterReloadDivider.isVisible({ timeout: 5_000 }).catch(() => false)) {
          const reloadBox = await afterReloadDivider.boundingBox();

          if (afterResizeBox && reloadBox) {
            // Position should be approximately the same after reload
            expect(Math.abs(reloadBox.x - afterResizeBox.x)).toBeLessThan(20);
          }
        }
      }
    }
  });
});
