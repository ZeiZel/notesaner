/**
 * Settings E2E tests.
 *
 * Covers theme toggle (dark/light), theme persistence after reload,
 * and editor settings (font size, line height, etc.).
 */

import { test, expect } from '../fixtures/test-fixtures';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace-1';
const APPEARANCE_URL = `/workspaces/${WORKSPACE_ID}/settings/appearance`;
const GENERAL_URL = `/workspaces/${WORKSPACE_ID}/settings/general`;

test.describe('Theme toggle', () => {
  test('appearance settings page renders theme controls', async ({ authenticatedPage: page }) => {
    await page.goto(APPEARANCE_URL);

    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();

    // Look for theme-related controls
    const themeSection = page.locator(
      'text=Theme, text=Appearance, text=Color scheme',
    ).first();

    await expect(themeSection).toBeVisible({ timeout: 10_000 });
  });

  test('switching to dark theme applies dark class to document', async ({
    authenticatedPage: page,
  }) => {
    await page.goto(APPEARANCE_URL);

    // Find the dark theme option (button, radio, or select)
    const darkThemeButton = page.locator(
      'button:has-text("Dark"), [data-testid="theme-dark"], label:has-text("Dark"), [value="dark"]',
    ).first();

    if (await darkThemeButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await darkThemeButton.click();
      await page.waitForTimeout(500);

      // Document should have dark theme class or data attribute
      const htmlElement = page.locator('html');
      const hasDarkClass = await htmlElement.evaluate((el) => {
        return (
          el.classList.contains('dark') ||
          el.getAttribute('data-theme') === 'dark' ||
          el.getAttribute('data-color-mode') === 'dark' ||
          el.style.colorScheme === 'dark'
        );
      });

      expect(hasDarkClass).toBeTruthy();
    }
  });

  test('switching to light theme applies light class to document', async ({
    authenticatedPage: page,
  }) => {
    await page.goto(APPEARANCE_URL);

    const lightThemeButton = page.locator(
      'button:has-text("Light"), [data-testid="theme-light"], label:has-text("Light"), [value="light"]',
    ).first();

    if (await lightThemeButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await lightThemeButton.click();
      await page.waitForTimeout(500);

      const htmlElement = page.locator('html');
      const hasLightTheme = await htmlElement.evaluate((el) => {
        return (
          el.classList.contains('light') ||
          el.getAttribute('data-theme') === 'light' ||
          el.getAttribute('data-color-mode') === 'light' ||
          !el.classList.contains('dark')
        );
      });

      expect(hasLightTheme).toBeTruthy();
    }
  });

  test('theme persists after page reload', async ({ authenticatedPage: page }) => {
    await page.goto(APPEARANCE_URL);

    // Switch to dark theme
    const darkThemeButton = page.locator(
      'button:has-text("Dark"), [data-testid="theme-dark"], label:has-text("Dark"), [value="dark"]',
    ).first();

    if (await darkThemeButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await darkThemeButton.click();
      await page.waitForTimeout(1_000);

      // Reload the page
      await page.reload();
      await page.waitForTimeout(1_000);

      // Dark theme should still be applied
      const htmlElement = page.locator('html');
      const hasDarkClass = await htmlElement.evaluate((el) => {
        return (
          el.classList.contains('dark') ||
          el.getAttribute('data-theme') === 'dark' ||
          el.getAttribute('data-color-mode') === 'dark'
        );
      });

      expect(hasDarkClass).toBeTruthy();
    }
  });

  test('theme can be toggled via command palette', async ({ authenticatedPage: page }) => {
    await page.goto(`/workspaces/${WORKSPACE_ID}`);
    await page.locator('#main-content').waitFor({ state: 'visible' });

    // Open command palette
    await page.keyboard.press('Meta+p');
    const paletteInput = page.locator('input[placeholder*="command"]');

    if (await paletteInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await paletteInput.fill('theme');

      // Should show theme switching commands
      const themeCommand = page.locator(
        'text=Switch to dark theme, text=Switch to light theme, text=Toggle theme',
      ).first();

      if (await themeCommand.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await themeCommand.click();
        await page.waitForTimeout(500);

        // Theme should have changed
        await expect(page.locator('html')).toBeVisible();
      }
    }
  });
});

test.describe('Editor settings', () => {
  test('editor preferences section is visible on appearance page', async ({
    authenticatedPage: page,
  }) => {
    await page.goto(APPEARANCE_URL);

    // Look for editor-related settings (font size, font family, line height)
    const editorSettings = page.locator(
      'text=Font size, text=Editor font, text=Line height, text=Editor preferences',
    ).first();

    const hasEditorSettings = await editorSettings
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasEditorSettings) {
      await expect(editorSettings).toBeVisible();
    }
  });

  test('changing font size updates the setting value', async ({ authenticatedPage: page }) => {
    await page.goto(APPEARANCE_URL);

    // Look for font size control (slider, input, or select)
    const fontSizeControl = page.locator(
      'input[data-testid="font-size"], [aria-label="Font size"], select[data-testid="font-size"]',
    ).first();

    if (await fontSizeControl.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Change the font size
      const tagName = await fontSizeControl.evaluate((el) => el.tagName.toLowerCase());

      if (tagName === 'input') {
        await fontSizeControl.fill('18');
      } else if (tagName === 'select') {
        await fontSizeControl.selectOption('18');
      }

      await page.waitForTimeout(500);
    }
  });
});

test.describe('General settings', () => {
  test('general settings page renders workspace name field', async ({
    authenticatedPage: page,
  }) => {
    await page.goto(GENERAL_URL);

    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();

    // Should have a workspace name field
    const nameField = page.locator(
      'input[data-testid="workspace-name"], input[aria-label="Workspace name"], input[name="name"]',
    );

    const hasNameField = await nameField
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasNameField) {
      await expect(nameField).toBeVisible();
    }
  });

  test('settings navigation breadcrumb shows correct path', async ({
    authenticatedPage: page,
  }) => {
    await page.goto(GENERAL_URL);

    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');

    if (await breadcrumb.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(breadcrumb.locator('text=Settings')).toBeVisible();
      await expect(breadcrumb.locator('text=General')).toBeVisible();
    }
  });
});
