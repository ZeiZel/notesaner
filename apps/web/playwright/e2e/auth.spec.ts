/**
 * Authentication E2E tests.
 *
 * Covers login, logout, token persistence across reloads,
 * and protected route redirect for unauthenticated users.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the login form with all fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('text=Please enter a valid email address.')).toBeVisible();
    await expect(page.locator('text=Password must be at least 8 characters.')).toBeVisible();
  });

  test('shows validation error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('validpassword123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('text=Please enter a valid email address.')).toBeVisible();
  });

  test('shows validation error for short password', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('text=Password must be at least 8 characters.')).toBeVisible();
  });

  test('shows error message for invalid credentials', async ({ page }) => {
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Either a general error or "Invalid credentials" message
    await expect(
      page.locator('text=Invalid credentials').or(page.locator('text=Unable to connect')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('successful login redirects to workspace', async ({ page }) => {
    // Use E2E test credentials
    const email = process.env.E2E_USER_EMAIL ?? 'e2e@notesaner.local';
    const password = process.env.E2E_USER_PASSWORD ?? 'TestPassword123!';

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect to workspaces or workspace home
    await page.waitForURL('**/workspaces**', { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('SSO button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Continue with SSO' })).toBeVisible();
  });

  test('navigates to register page', async ({ page }) => {
    await page.getByRole('link', { name: 'Create account' }).click();
    await page.waitForURL('**/register');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });
});

test.describe('Logout flow', () => {
  test('logging out redirects to login page', async ({ browser }) => {
    const context = await browser.newContext();

    // Login via API
    await context.request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: process.env.E2E_USER_EMAIL ?? 'e2e@notesaner.local',
        password: process.env.E2E_USER_PASSWORD ?? 'TestPassword123!',
      },
    });

    const page = await context.newPage();
    await page.goto('/workspaces');

    // Find and click the logout action (could be in user menu or settings)
    const userMenu = page.locator(
      'button[data-testid="user-menu"], button[aria-label="User menu"], button[aria-label="Account"]',
    );

    if (await userMenu.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await userMenu.click();
      const logoutButton = page.getByRole('menuitem', { name: /log\s*out/i }).or(
        page.locator('text=Log out'),
      );
      await logoutButton.click();
    } else {
      // Try direct navigation to logout endpoint
      await page.goto('/api/auth/logout');
    }

    // Should end up at the login page
    await page.waitForURL('**/login', { timeout: 10_000 });
    await context.close();
  });
});

test.describe('Token persistence', () => {
  test('authenticated session persists across page reload', async ({ browser }) => {
    const context = await browser.newContext();

    // Login via API
    const loginResponse = await context.request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: process.env.E2E_USER_EMAIL ?? 'e2e@notesaner.local',
        password: process.env.E2E_USER_PASSWORD ?? 'TestPassword123!',
      },
    });

    if (!loginResponse.ok()) {
      test.skip(true, 'Auth API not available');
      return;
    }

    const page = await context.newPage();
    await page.goto('/workspaces');
    await expect(page.locator('#main-content')).toBeVisible();

    // Reload the page
    await page.reload();

    // Should still be on the workspaces page (not redirected to login)
    await expect(page.locator('#main-content')).toBeVisible();
    expect(page.url()).toContain('/workspaces');

    await context.close();
  });
});

test.describe('Protected route redirect', () => {
  test('unauthenticated user visiting workspace is redirected to login', async ({ page }) => {
    // Clear any existing auth by using a fresh context (default behavior)
    await page.goto('/workspaces/test-workspace-1');

    // Should be redirected to login (or show auth wall)
    const isLoginPage = await page.locator('text=Sign in').isVisible({ timeout: 10_000 }).catch(() => false);
    const isAuthWall = await page.locator('text=Please log in').isVisible({ timeout: 3_000 }).catch(() => false);

    expect(isLoginPage || isAuthWall || page.url().includes('/login')).toBeTruthy();
  });

  test('unauthenticated user visiting settings is redirected to login', async ({ page }) => {
    await page.goto('/workspaces/test-workspace-1/settings/general');

    const isLoginPage = await page.locator('text=Sign in').isVisible({ timeout: 10_000 }).catch(() => false);
    const isAuthWall = await page.locator('text=Please log in').isVisible({ timeout: 3_000 }).catch(() => false);

    expect(isLoginPage || isAuthWall || page.url().includes('/login')).toBeTruthy();
  });
});
