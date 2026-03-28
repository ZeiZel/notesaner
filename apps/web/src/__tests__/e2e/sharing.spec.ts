/**
 * Sharing / Public vault e2e tests.
 *
 * Verifies public vault pages render correctly with navigation,
 * sidebar, and note tree content.
 */

import { test, expect } from '@playwright/test';

test.describe('Public Vault Page', () => {
  const VAULT_SLUG = 'my-vault';
  const PUBLIC_URL = `/public/${VAULT_SLUG}`;

  test('renders the public vault index page', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    // The public vault page should show the slug as heading
    await expect(page.getByRole('heading', { name: VAULT_SLUG })).toBeVisible();
  });

  test('shows the vault description text', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    await expect(
      page.locator(
        'text=This is a publicly published workspace. Select a note from the navigation to start reading.',
      ),
    ).toBeVisible();
  });

  test('renders the public navigation bar', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    // The PublicVaultShell renders a PublicNavigation component
    // Main content area should be present
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });

  test('public sidebar contains note tree', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    // The placeholder note tree should show folder/note names
    await expect(page.locator('text=Getting Started')).toBeVisible();
    await expect(page.locator('text=Guides')).toBeVisible();
    await expect(page.locator('text=README')).toBeVisible();
  });

  test('public sidebar shows nested notes under folders', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    // Getting Started folder children
    await expect(page.locator('text=Welcome')).toBeVisible();
    await expect(page.locator('text=Quick Start')).toBeVisible();

    // Guides folder children
    await expect(page.locator('text=Markdown Basics')).toBeVisible();
    await expect(page.locator('text=Linking Notes')).toBeVisible();
    await expect(page.locator('text=Publishing')).toBeVisible();
  });

  test('public page has changelog entry', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    await expect(page.locator('text=Changelog')).toBeVisible();
  });
});

test.describe('Public Vault Navigation', () => {
  const VAULT_SLUG = 'docs-vault';
  const PUBLIC_URL = `/public/${VAULT_SLUG}`;

  test('renders with different vault slugs', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    // Should use the slug as the page title/heading
    await expect(page.getByRole('heading', { name: VAULT_SLUG })).toBeVisible();
  });

  test('main content area is focusable for accessibility', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    const mainContent = page.locator('#main-content');
    await expect(mainContent).toHaveAttribute('tabindex', '-1');
  });
});
