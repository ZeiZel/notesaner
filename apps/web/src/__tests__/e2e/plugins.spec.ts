/**
 * Plugins page e2e tests.
 *
 * Verifies the plugin browser page loads with heading, description,
 * and the dynamically imported PluginBrowser component renders
 * (or at least its skeleton).
 */

import { test, expect } from '@playwright/test';

const WORKSPACE_ID = 'test-workspace-1';
const PLUGINS_URL = `/workspaces/${WORKSPACE_ID}/plugins`;

test.describe('Plugin Browser Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PLUGINS_URL);
  });

  test('renders the plugin browser heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Plugin browser' })).toBeVisible();
  });

  test('shows the plugin browser description', async ({ page }) => {
    await expect(
      page.locator('text=Discover and install plugins to extend your workspace.'),
    ).toBeVisible();
  });

  test('plugin browser content area is present', async ({ page }) => {
    // The plugin browser area should exist (either with loaded content
    // or skeleton loading state)
    const contentArea = page.locator('.flex-1.overflow-hidden');
    await expect(contentArea).toBeVisible();
  });

  test('plugin browser renders within error boundary', async ({ page }) => {
    // Should not show error boundary fallback
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });

  test('page is wrapped in workspace shell', async ({ page }) => {
    // The page is under the workspace layout, so the workspace
    // shell toolbar and sidebar should be present
    const toolbar = page.locator('header[role="banner"]');
    await expect(toolbar).toBeVisible();
  });
});

test.describe('Plugin Settings Page', () => {
  const PLUGINS_SETTINGS_URL = `/workspaces/${WORKSPACE_ID}/settings/plugins`;

  test('plugin settings tab renders', async ({ page }) => {
    await page.goto(PLUGINS_SETTINGS_URL);

    // Settings layout should be visible (may show permission denied
    // without auth, but the page itself should load)
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });
});
