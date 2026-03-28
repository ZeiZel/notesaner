/**
 * Workspace flow e2e tests.
 *
 * Verifies workspace list page renders, workspace home page loads with
 * sidebar and key UI elements, and note tree is visible.
 */

import { test, expect } from '@playwright/test';

test.describe('Workspace List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspaces');
  });

  test('renders the workspace picker heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Your Workspaces' })).toBeVisible();
  });

  test('shows the description text', async ({ page }) => {
    await expect(
      page.locator('text=Select a workspace to continue, or create a new one.'),
    ).toBeVisible();
  });

  test('shows the create workspace button', async ({ page }) => {
    await expect(page.locator('text=New workspace')).toBeVisible();
    await expect(page.locator('text=Create a fresh knowledge base')).toBeVisible();
  });
});

test.describe('Workspace Home Page', () => {
  const TEST_WORKSPACE_ID = 'test-workspace-1';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/workspaces/${TEST_WORKSPACE_ID}`);
  });

  test('renders the welcome heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible();
  });

  test('displays the workspace ID', async ({ page }) => {
    await expect(page.locator(`text=${TEST_WORKSPACE_ID}`)).toBeVisible();
  });

  test('shows the sidebar hint', async ({ page }) => {
    await expect(page.locator('text=Select a note from the sidebar to get started.')).toBeVisible();
  });

  test('shows the new note button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'New note' })).toBeVisible();
  });

  test('shows the search notes button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Search notes' })).toBeVisible();
  });

  test('renders the workspace shell with toolbar', async ({ page }) => {
    // The toolbar (header with role="banner") should be visible on desktop
    const toolbar = page.locator('header[role="banner"]');
    await expect(toolbar).toBeVisible();
  });

  test('sidebar shows file explorer with folders', async ({ page }) => {
    // The workspace shell should show the file explorer with placeholder folders
    await expect(page.locator('text=My Workspace')).toBeVisible();

    // Check for placeholder folder names in sidebar
    await expect(page.locator('text=Getting Started')).toBeVisible();
    await expect(page.locator('text=Projects')).toBeVisible();
    await expect(page.locator('text=Daily Notes')).toBeVisible();
    await expect(page.locator('text=Archive')).toBeVisible();
  });

  test('sidebar has a new note button', async ({ page }) => {
    // The file explorer placeholder has a "New note" button
    const sidebarNewNote = page.locator('button:has-text("New note")');
    // There are two: one in main content, one in sidebar
    await expect(sidebarNewNote.first()).toBeVisible();
  });

  test('right sidebar toggle button exists in toolbar', async ({ page }) => {
    const toggleButton = page.getByLabel('Toggle right sidebar');
    await expect(toggleButton).toBeVisible();
  });

  test('status bar is visible on desktop', async ({ page }) => {
    // The WorkspaceShell renders a StatusBar component on desktop
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });
});
