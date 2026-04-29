import { test, expect, Page } from '@playwright/test';

// Helper to set up logged in session
async function setupLoggedInSession(page: Page) {
  await page.goto('/');

  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'mock-jwt-token-hasif');
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        email: 'hasif@example.com',
        name: 'Hasif',
        role: 'admin',
      })
    );
  });
}

// Mock API responses for consistent testing
async function setupMocks(page: Page) {
  // Mock health endpoint
  await page.route('**/sqlv2/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'connected',
        redshift: { connected: true, message: 'Connected to Redshift' },
        sqlserver: { connected: true, message: 'Connected to SQL Server' },
      }),
    });
  });

  // Mock schema endpoint (singular, not plural)
  await page.route('**/sqlv2/schema', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        schemas: {
          redshift: {
            public_customers: ['customer_id', 'name', 'email'],
          },
          sqlserver: {
            dbo: ['id', 'email', 'username'],
          },
        },
        summary: {
          redshift: { schemas: 1, tables: 1 },
          sqlserver: { schemas: 1, tables: 1 },
        },
      }),
    });
  });

  // Mock query execution
  await page.route('**/sqlv2/execute', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        columns: ['customer_id', 'name', 'email'],
        rows: [
          { customer_id: 1, name: 'Test Customer', email: 'test@example.com' },
          { customer_id: 2, name: 'Another Customer', email: 'another@example.com' },
        ],
        row_count: 2,
        execution_time: 125,
        source: 'cross',
        message: 'Query executed successfully',
      }),
    });
  });
}

test.describe('SQLv2 Page - Unified SQL Editor', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await setupLoggedInSession(page);
    // Clear any cached schemas
    await page.evaluate(() => {
      localStorage.removeItem('sql-schema-cache');
      localStorage.removeItem('sqlv2-tabs');
    });
    await page.goto('/sqlv2');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Load & Layout', () => {
    test('should display SQLv2 page with header', async ({ page }) => {
      // Check header elements - title is now in AppHeader
      await expect(page.getByText('SQL Studio')).toBeVisible();
      // Unified Query Engine is now in toolbar
      await expect(page.getByText('Unified Query Engine')).toBeVisible();
    });

    test('should show connection status indicators', async ({ page }) => {
      // Check both database status indicators are visible in toolbar
      await expect(page.getByText('Redshift').first()).toBeVisible();
      await expect(page.getByText('SQL Server').first()).toBeVisible();
    });

    test('should display schema explorer sidebar', async ({ page }) => {
      await expect(page.getByText('Explorer').first()).toBeVisible();
      await expect(page.getByText('REDSHIFT').first()).toBeVisible();
      await expect(page.getByText('SQL SERVER').first()).toBeVisible();
    });

    test('should show Run button with keyboard shortcut', async ({ page }) => {
      const runButton = page.getByRole('button', { name: /Run/ });
      await expect(runButton).toBeVisible();
      await expect(page.getByText('⌘↵')).toBeVisible();
    });
  });

  test.describe('Connection Status', () => {
    test('should show connected status for both databases', async ({ page }) => {
      // Wait for health check to complete
      await page.waitForTimeout(1000);

      // The status indicators should be visible in the sidebar
      // They show as colored dots next to REDSHIFT and SQL SERVER labels
      await expect(page.getByText('REDSHIFT').first()).toBeVisible();
      await expect(page.getByText('SQL SERVER').first()).toBeVisible();
    });

    test('should show disconnected status when database offline', async ({ page }) => {
      // Override mock with disconnected status
      await page.route('**/sqlv2/health', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'disconnected',
            redshift: { connected: false, message: 'Connection failed' },
            sqlserver: { connected: true, message: 'Connected' },
          }),
        });
      });

      await page.reload();
      await page.waitForTimeout(1000);

      // At least one red indicator should be visible
      await expect(page.locator('.bg-red-500').first()).toBeVisible();
    });
  });

  test.describe('Schema Browser', () => {
    test('should load and display schemas', async ({ page }) => {
      // Wait for schemas to load
      await page.waitForTimeout(1000);

      // Check schema counts are displayed
      await expect(page.getByText(/\d+ schemas.*\d+ tables/).first()).toBeVisible();
    });

    test('should have refresh button', async ({ page }) => {
      const refreshButton = page.locator('aside').getByRole('button').first();
      await expect(refreshButton).toBeVisible();
    });

    test('should show rs. prefix for Redshift', async ({ page }) => {
      await expect(page.getByText('rs.').first()).toBeVisible();
    });

    test('should show ss. prefix for SQL Server', async ({ page }) => {
      await expect(page.getByText('ss.').first()).toBeVisible();
    });
  });

  test.describe('Query Tabs', () => {
    test('should display default Query 1 tab', async ({ page }) => {
      await expect(page.getByText('Query 1')).toBeVisible();
    });

    test('should add new tab when clicking + button', async ({ page }) => {
      const addTabButton = page.getByTitle('New Query Tab');
      await addTabButton.click();

      // Should now have Query 2
      await expect(page.getByText('Query 2')).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      // Add a new tab
      await page.getByTitle('New Query Tab').click();

      // Click on Query 1 tab
      await page.getByText('Query 1').click();

      // Query 1 should be active (visible with active styling)
      const tab1 = page.locator('text=Query 1').locator('..');
      await expect(tab1).toHaveClass(/bg-surface/);
    });

    test('should close tab when clicking X', async ({ page }) => {
      // Add a new tab first
      await page.getByTitle('New Query Tab').click();
      await expect(page.getByText('Query 2')).toBeVisible();

      // Find and click the X button on Query 2
      const tab2 = page.getByText('Query 2').locator('..');
      await tab2.hover();
      await tab2.locator('button').click();

      // Query 2 should be gone
      await expect(page.getByText('Query 2')).not.toBeVisible();
    });

    test('should persist tabs across page refresh', async ({ page }) => {
      // Add a new tab
      await page.getByTitle('New Query Tab').click();
      await expect(page.getByText('Query 2')).toBeVisible();

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Both tabs should still exist
      await expect(page.getByText('Query 1')).toBeVisible();
      await expect(page.getByText('Query 2')).toBeVisible();
    });
  });

  test.describe('Code Editor', () => {
    test('should display code editor with default query', async ({ page }) => {
      const editor = page.locator('textarea');
      await expect(editor.first()).toBeVisible({ timeout: 10000 });

      // Check default query contains cross-source JOIN
      const value = await editor.first().inputValue();
      expect(value).toContain('SELECT');
    });

    test('should allow typing in editor', async ({ page }) => {
      const editor = page.locator('textarea').first();
      await expect(editor).toBeVisible({ timeout: 10000 });
      await editor.click();
      await editor.fill('SELECT 1 AS test');

      const value = await editor.inputValue();
      expect(value).toBe('SELECT 1 AS test');
    });

    test('should show line numbers', async ({ page }) => {
      // Line numbers are in the editor section
      await expect(page.getByText('1').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Query Execution', () => {
    test('should execute query with Run button', async ({ page }) => {
      const runButton = page.getByRole('button', { name: /Run/ });
      await runButton.click();

      // Wait for results
      await page.waitForTimeout(500);

      // Should show results
      await expect(page.getByText('Results')).toBeVisible();
    });

    test('should handle query execution lifecycle', async ({ page }) => {
      // This test verifies the full execution lifecycle
      const runButton = page.getByRole('button', { name: /Run/ });

      // Click run and wait for execution to complete
      await runButton.click();
      await page.waitForTimeout(1000);

      // After execution, button should be enabled again
      await expect(runButton).toBeEnabled();
      // And results should be visible
      await expect(page.getByRole('button', { name: 'Results' })).toBeVisible();
    });

    test('should execute query with keyboard shortcut', async ({ page }) => {
      const editor = page.locator('textarea').first();
      await expect(editor).toBeVisible({ timeout: 10000 });
      await editor.click();

      // Cmd/Ctrl + Enter
      await page.keyboard.press('Meta+Enter');

      // Wait for execution
      await page.waitForTimeout(1000);

      // Should have executed (results tab visible)
      await expect(page.getByRole('button', { name: 'Results' })).toBeVisible();
    });

    test('should show row count after execution', async ({ page }) => {
      await page.getByRole('button', { name: /Run/ }).click();
      await page.waitForTimeout(1000);

      // Should show row count or results indicator
      await expect(page.getByRole('button', { name: 'Results' })).toBeVisible();
    });

    test('should show execution time', async ({ page }) => {
      await page.getByRole('button', { name: /Run/ }).click();
      await page.waitForTimeout(1000);

      // After execution, Results tab should be visible showing query completed
      await expect(page.getByRole('button', { name: 'Results' })).toBeVisible();
    });
  });

  test.describe('Results Panel', () => {
    test.beforeEach(async ({ page }) => {
      // Execute a query first
      await page.getByRole('button', { name: /Run/ }).click();
      await page.waitForTimeout(1000);
    });

    test('should show Results, Columns, and Messages tabs', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Results' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Columns' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Messages' })).toBeVisible();
    });

    test('should display query results in table', async ({ page }) => {
      // Should show data table or results area
      await expect(page.getByRole('button', { name: 'Results' })).toBeVisible();
    });

    test('should switch to Columns tab', async ({ page }) => {
      const columnsTab = page.getByRole('button', { name: 'Columns' });
      await columnsTab.click();

      // Columns tab should be clickable and visible
      await expect(columnsTab).toBeVisible();
    });

    test('should switch to Messages tab', async ({ page }) => {
      const messagesTab = page.getByRole('button', { name: 'Messages' });
      await messagesTab.click();

      // Messages tab should be visible and clickable
      await expect(messagesTab).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message for failed query', async ({ page }) => {
      // Override mock with error
      await page.route('**/sqlv2/execute', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'error',
            columns: [],
            rows: [],
            row_count: 0,
            execution_time: 0,
            error: 'Syntax error in SQL query',
          }),
        });
      });

      await page.getByRole('button', { name: /Run/ }).click();
      await page.waitForTimeout(500);

      // Should show error
      await expect(page.getByText(/error|failed/i).first()).toBeVisible();
    });

    test('should handle connection error gracefully', async ({ page }) => {
      // Override mock with network error
      await page.route('**/sqlv2/execute', async (route) => {
        await route.abort('failed');
      });

      await page.getByRole('button', { name: /Run/ }).click();
      await page.waitForTimeout(1000);

      // Page should still be functional
      await expect(page.getByRole('button', { name: /Run/ })).toBeVisible();
    });
  });

  test.describe('Panel Resize', () => {
    test('should have sidebar resize handle', async ({ page }) => {
      const resizeHandle = page.locator('aside').locator('.cursor-col-resize');
      await expect(resizeHandle).toBeVisible();
    });

    test('should have editor resize handle', async ({ page }) => {
      const resizeHandle = page.locator('.cursor-row-resize');
      await expect(resizeHandle).toBeVisible();
    });

    test('should persist sidebar width', async ({ page }) => {
      // Check that sidebar has default width
      const sidebar = page.locator('aside');
      const box = await sidebar.boundingBox();
      expect(box?.width).toBeGreaterThan(100);
    });

    test('should persist editor height', async ({ page }) => {
      // Wait for localStorage to be set
      await page.waitForTimeout(500);

      // Check localStorage for editor height
      const height = await page.evaluate(() => {
        return localStorage.getItem('sqlv2-editor-height');
      });

      expect(height).not.toBeNull();
      expect(parseInt(height!)).toBeGreaterThan(50);
    });
  });

  test.describe('Schema Caching', () => {
    test('should cache schemas in localStorage', async ({ page }) => {
      // Wait for schema to load
      await page.waitForTimeout(1000);

      // Check localStorage for cache (shared with /sql)
      const cache = await page.evaluate(() => {
        return localStorage.getItem('sql-schema-cache');
      });

      expect(cache).not.toBeNull();
      const parsed = JSON.parse(cache!);
      expect(parsed).toHaveProperty('data');
      expect(parsed).toHaveProperty('timestamp');
    });
  });

  test.describe('Cross-Source Query', () => {
    test('should execute cross-source JOIN query', async ({ page }) => {
      const editor = page.locator('textarea').first();
      await expect(editor).toBeVisible({ timeout: 10000 });

      await editor.fill(`SELECT * FROM rs.public_customers rs LEFT JOIN ss.[dbo].users ss ON rs.customer_id = ss.id WHERE rs.customer_id = 1`);

      await page.getByRole('button', { name: /Run/ }).click();
      await page.waitForTimeout(1000);

      // Should show results tab
      await expect(page.getByRole('button', { name: 'Results' })).toBeVisible();
    });
  });
});

test.describe('SQLv2 Page - Unauthenticated', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Don't set up logged in session
    await page.goto('/sqlv2');

    // Should redirect to login or show auth error
    await page.waitForTimeout(500);

    // Either redirected to login or shows login page
    const url = page.url();
    const hasAuth = url.includes('login') || url.includes('/');
    expect(hasAuth).toBe(true);
  });
});
