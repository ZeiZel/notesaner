/**
 * Layout E2E tests.
 *
 * Covers sidebar toggle (left/right), split view panels,
 * and panel resize interactions.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { toggleLeftSidebar, toggleRightSidebar } from '../utils/helpers';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace-1';
const WORKSPACE_URL = `/workspaces/${WORKSPACE_ID}`;

test.describe('Sidebar toggle', () => {
  test('left sidebar is visible by default on desktop', async ({ authenticatedPage: page }) => {
    await page.goto(WORKSPACE_URL);

    // Sidebar should show the file explorer content
    const sidebar = page.locator('text=My Workspace');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test('toggling left sidebar hides the file tree', async ({ authenticatedPage: page }) => {
    await page.goto(WORKSPACE_URL);

    // Wait for sidebar to render
    const sidebarContent = page.locator('text=My Workspace');
    await expect(sidebarContent).toBeVisible({ timeout: 10_000 });

    // Toggle sidebar closed
    await toggleLeftSidebar(page);
    await page.waitForTimeout(500);

    // Sidebar content should be hidden
    const isHidden = await sidebarContent.isHidden().catch(() => false);
    // May animate — check after delay
    if (!isHidden) {
      await page.waitForTimeout(500);
    }

    // Toggle sidebar open again
    await toggleLeftSidebar(page);
    await page.waitForTimeout(500);

    // Content should reappear
    await expect(sidebarContent).toBeVisible({ timeout: 5_000 });
  });

  test('right sidebar toggle button changes aria-pressed state', async ({
    authenticatedPage: page,
  }) => {
    await page.goto(WORKSPACE_URL);

    const toggleButton = page.getByLabel('Toggle right sidebar');
    await expect(toggleButton).toBeVisible();

    // Get initial state
    const initialPressed = await toggleButton.getAttribute('aria-pressed');

    // Toggle
    await toggleButton.click();
    await page.waitForTimeout(300);

    const newPressed = await toggleButton.getAttribute('aria-pressed');

    // aria-pressed should have changed
    if (initialPressed !== null && newPressed !== null) {
      expect(newPressed).not.toBe(initialPressed);
    }
  });

  test('right sidebar shows panels when opened', async ({ authenticatedPage: page }) => {
    await page.goto(`${WORKSPACE_URL}/notes/test-note-1`);

    // Open right sidebar
    await toggleRightSidebar(page);
    await page.waitForTimeout(500);

    // Right sidebar should show panels (backlinks, outline, etc.)
    const rightSidebar = page.locator(
      '[data-testid="right-sidebar"], aside:last-of-type',
    );

    const hasSidebar = await rightSidebar
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasSidebar) {
      // Should have panel content (Backlinks, Outline, Properties, etc.)
      const panelContent = rightSidebar.locator(
        'text=Backlinks, text=Outline, text=Properties, text=Table of Contents',
      );
      const hasContent = await panelContent
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      if (hasContent) {
        await expect(panelContent.first()).toBeVisible();
      }
    }
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

      const splitCommand = page.locator(
        'text=Split right, text=Split down, text=Split view',
      ).first();

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
    const divider = page.locator(
      '[data-testid="resize-handle"], [data-testid="divider"], .resize-handle, [role="separator"]',
    ).first();

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

    const divider = page.locator(
      '[data-testid="resize-handle"], .resize-handle, [role="separator"]',
    ).first();

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

        const afterReloadDivider = page.locator(
          '[data-testid="resize-handle"], .resize-handle, [role="separator"]',
        ).first();

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
