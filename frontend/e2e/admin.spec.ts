import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test('should access admin dashboard', async ({ page }) => {
    // Should show admin dashboard
    await expect(page.getByRole('heading', { name: 'Admin Overview' })).toBeVisible({ timeout: 5000 });
  });

  test('should show admin navigation sidebar', async ({ page }) => {
    // Should have navigation links
    await expect(page.getByRole('link', { name: 'Overview', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Query Logs', exact: true })).toBeVisible();
  });

  test('should show role permissions table', async ({ page }) => {
    // Should show permissions table headers
    await expect(page.getByRole('columnheader', { name: 'Permission' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Editor' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Viewer' })).toBeVisible();
  });

  test('should navigate to users page', async ({ page }) => {
    // Click on Users link in sidebar
    await page.getByRole('link', { name: 'Users', exact: true }).click();

    // Should be on users page
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to logs page', async ({ page }) => {
    // Click on Query Logs link in sidebar
    await page.getByRole('link', { name: 'Query Logs', exact: true }).click();

    // Should be on logs page
    await expect(page).toHaveURL(/\/admin\/logs/);
  });
});
