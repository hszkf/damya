import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
  });

  test('should display user list', async ({ page }) => {
    // Should show user management heading
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 5000 });

    // Should show table with users
    await expect(page.getByRole('table')).toBeVisible();

    // Should show at least the default users in table rows
    await expect(page.getByText('@hasif')).toBeVisible();
    await expect(page.getByText('@nazierul')).toBeVisible();
  });

  test('should show Add User button', async ({ page }) => {
    // Should have Add User button
    await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible({ timeout: 5000 });
  });

  test('should open Add User modal', async ({ page }) => {
    // Click Add User button
    await page.getByRole('button', { name: 'Add User' }).click();

    // Modal should be visible with "Create User" heading
    await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible({ timeout: 5000 });

    // Modal should have form fields
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should create new user', async ({ page }) => {
    // Click Add User button
    await page.getByRole('button', { name: 'Add User' }).click();

    // Wait for modal
    await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible({ timeout: 5000 });

    // Fill in user details
    const testUsername = `testuser${Date.now()}`;
    await page.getByLabel('Username').fill(testUsername);
    await page.getByLabel('Password').fill('testpassword123');

    // Submit form - click Create button
    await page.getByRole('button', { name: 'Create' }).click();

    // Wait for modal to close
    await expect(page.getByRole('heading', { name: 'Create User' })).not.toBeVisible({ timeout: 5000 });

    // New user should appear in list
    await expect(page.getByText(`@${testUsername.toLowerCase()}`)).toBeVisible({ timeout: 5000 });
  });

  test('should show user roles in table', async ({ page }) => {
    // Should display role badges in table
    const table = page.getByRole('table');
    await expect(table.getByText('admin').first()).toBeVisible({ timeout: 5000 });
    await expect(table.getByText('editor').first()).toBeVisible();
    await expect(table.getByText('viewer').first()).toBeVisible();
  });

  test('should have edit buttons for users', async ({ page }) => {
    // Should have edit buttons (button with title "Edit user")
    const editButtons = page.getByRole('button', { name: 'Edit user' });
    await expect(editButtons.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('User Edit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
  });

  test('should open edit modal for user', async ({ page }) => {
    // Find and click edit button for a user
    const editButton = page.getByRole('button', { name: 'Edit user' }).first();
    await editButton.click();

    // Edit modal should be visible with "Edit User" heading
    await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible({ timeout: 5000 });
  });
});
