/**
 * Auth flow e2e tests.
 *
 * Verifies login and register pages render correctly, form validation
 * works, error messages display, and navigation between auth pages.
 */

import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the login page with brand and form', async ({ page }) => {
    // Brand mark
    await expect(page.locator('text=Notesaner')).toBeVisible();

    // Page heading
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // Subtitle
    await expect(
      page.locator('text=Welcome back. Enter your credentials to continue.'),
    ).toBeVisible();

    // Form fields
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('shows the SSO button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Continue with SSO' })).toBeVisible();
  });

  test('has a link to the register page', async ({ page }) => {
    const registerLink = page.getByRole('link', { name: 'Create account' });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute('href', '/register');
  });

  test('has a forgot password link', async ({ page }) => {
    const forgotLink = page.getByRole('link', { name: 'Forgot password?' });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', '/forgot-password');
  });

  test('shows validation error for invalid email', async ({ page }) => {
    // Fill invalid email, valid password
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('validpassword123');

    // Submit
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Expect email validation error
    await expect(page.locator('text=Please enter a valid email address.')).toBeVisible();
  });

  test('shows validation error for short password', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('short');

    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('text=Password must be at least 8 characters.')).toBeVisible();
  });

  test('shows validation errors for empty form submission', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('text=Please enter a valid email address.')).toBeVisible();
    await expect(page.locator('text=Password must be at least 8 characters.')).toBeVisible();
  });

  test('navigates to register page via link', async ({ page }) => {
    await page.getByRole('link', { name: 'Create account' }).click();
    await page.waitForURL('**/register');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });
});

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders the register page with brand and form', async ({ page }) => {
    // Brand mark
    await expect(page.locator('text=Notesaner')).toBeVisible();

    // Page heading
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

    // Subtitle
    await expect(page.locator('text=Start your Notesaner workspace today.')).toBeVisible();

    // Form fields
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('has a link to the login page', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: 'Sign in' });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });

  test('shows validation error for short name', async ({ page }) => {
    await page.getByLabel('Name').fill('A');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('validpassword123');

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('text=Name must be at least 2 characters.')).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Email').fill('invalid');
    await page.getByLabel('Password').fill('validpassword123');

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('text=Please enter a valid email address.')).toBeVisible();
  });

  test('shows validation error for short password', async ({ page }) => {
    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('short');

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('text=Password must be at least 8 characters.')).toBeVisible();
  });

  test('shows all validation errors for empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('text=Name must be at least 2 characters.')).toBeVisible();
    await expect(page.locator('text=Please enter a valid email address.')).toBeVisible();
    await expect(page.locator('text=Password must be at least 8 characters.')).toBeVisible();
  });

  test('navigates to login page via link', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
