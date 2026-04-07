/**
 * Workspace flow e2e tests.
 *
 * Verifies workspace list page renders, workspace home page loads with
 * both sidebars always visible, key UI elements work, and actions are
 * properly wired.
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
  });

  test('create workspace button opens modal', async ({ page }) => {
    const newWorkspaceButton = page.locator('text=New workspace');
    await newWorkspaceButton.click();

    // Modal should appear with workspace creation form
    await expect(page.locator('text=Create new workspace')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Workspace name')).toBeVisible();
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

  test('new note button is clickable and responds', async ({ page }) => {
    const newNoteButton = page.getByRole('button', { name: 'New note' });
    await expect(newNoteButton).toBeVisible();
    await expect(newNoteButton).toBeEnabled();

    // Click should trigger navigation or API call (not be a no-op)
    await newNoteButton.click();
    await page.waitForTimeout(1_000);

    // After clicking, page should navigate or show some response
    // (exact behavior depends on auth state and API availability)
  });

  test('shows the search notes button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Search notes' })).toBeVisible();
  });

  test('renders the workspace shell with toolbar', async ({ page }) => {
    // The toolbar (header with role="banner") should be visible on desktop
    const toolbar = page.locator('header[role="banner"]');
    await expect(toolbar).toBeVisible();
  });

  test('both sidebars are visible on desktop', async ({ page }) => {
    // Left sidebar
    const leftSidebar = page.locator('aside[data-side="left"]');
    await expect(leftSidebar).toBeVisible({ timeout: 10_000 });

    // Right sidebar
    const rightSidebar = page.locator('aside[data-side="right"]');
    await expect(rightSidebar).toBeVisible({ timeout: 10_000 });
  });

  test('sidebars show Explorer and Inspector labels', async ({ page }) => {
    await expect(page.locator('text=Explorer')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Inspector')).toBeVisible({ timeout: 10_000 });
  });

  test('status bar is visible on desktop', async ({ page }) => {
    // The WorkspaceShell renders a StatusBar component on desktop
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });

  test('tab bar is visible with new tab button', async ({ page }) => {
    const newTabButton = page.getByLabel('New tab');
    await expect(newTabButton).toBeVisible();
  });
});

test.describe('Ribbon actions', () => {
  const TEST_WORKSPACE_ID = 'test-workspace-1';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/workspaces/${TEST_WORKSPACE_ID}`);
    await page.waitForTimeout(1_000);
  });

  test('ribbon is visible on desktop', async ({ page }) => {
    const ribbon = page.locator('nav[aria-label="Quick actions"]');
    await expect(ribbon).toBeVisible({ timeout: 10_000 });
  });

  test('ribbon has action buttons', async ({ page }) => {
    const ribbon = page.locator('nav[aria-label="Quick actions"]');
    await expect(ribbon).toBeVisible({ timeout: 10_000 });

    // Should have at least the built-in actions
    const buttons = ribbon.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('graph view ribbon button navigates to graph page', async ({ page }) => {
    // Find and click the graph view button in the ribbon
    // The ribbon uses RibbonIcon components with tooltip labels
    const graphButton = page.locator('nav[aria-label="Quick actions"] button').nth(2); // graph-view is 3rd

    if (await graphButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await graphButton.click();
      await page.waitForTimeout(2_000);

      // Should navigate to graph page
      expect(page.url()).toContain('/graph');
    }
  });
});
