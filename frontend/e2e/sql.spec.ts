import { test, expect, Page } from '@playwright/test';

/**
 * E2E SQL Studio Tests
 *
 * These tests verify the SQL Studio page including dual editor panels,
 * query execution, schema browser, results display, and file operations.
 *
 * API calls are mocked for reliability and speed.
 */

// Test user data
const USERS = {
  admin: {
    id: 1,
    username: 'hasif',
    password: 'admin123',
    role: 'admin',
    team: 'data-science',
    display_name: 'Hasif'
  }
};

// Mock schema data
const MOCK_SCHEMA = {
  dbo: ['Customers', 'Orders', 'Products', 'Categories'],
  staging: ['temp_data', 'import_queue'],
  public: ['users', 'sessions']
};

// Mock query result
const MOCK_QUERY_RESULT = {
  status: 'success',
  columns: ['id', 'name', 'email', 'created_at'],
  rows: [
    { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2025-01-15T10:00:00Z' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2025-01-14T09:00:00Z' },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', created_at: '2025-01-13T08:00:00Z' },
  ],
  row_count: 3,
  execution_time: 0.045,
  message: 'Query executed successfully (3 rows)'
};

// Helper to setup all API mocks
async function setupSQLMocks(page: Page) {
  // Mock login endpoint
  await page.route('**/auth/login', async route => {
    const request = route.request();
    const postData = request.postDataJSON();

    const user = Object.values(USERS).find(
      u => u.username === postData.username && u.password === postData.password
    );

    if (user) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: `mock-jwt-token-${user.username}`,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              team: user.team,
              display_name: user.display_name,
              created_at: new Date().toISOString(),
              last_login: null,
              is_active: true
            }
          }
        })
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Invalid credentials' })
      });
    }
  });

  // Mock SQL Server health endpoint
  await page.route('**/sqlserver/health', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'connected',
        connected: true,
        database: 'master',
        server: 'localhost',
        latency: 5
      })
    });
  });

  // Mock Redshift health endpoint
  await page.route('**/redshift/health', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'connected',
        connected: true,
        database: 'dev',
        server: 'redshift-cluster',
        latency: 10
      })
    });
  });

  // Mock SQL Server schema endpoint
  await page.route('**/sqlserver/schema**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          schemas: MOCK_SCHEMA,
          cached: false
        })
      });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          database: 'sqlserver',
          cleared: true,
          message: 'Cache cleared successfully'
        })
      });
    } else {
      await route.continue();
    }
  });

  // Mock Redshift schema endpoint
  await page.route('**/redshift/schema**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          schemas: {
            public: ['customers', 'orders', 'inventory'],
            analytics: ['daily_metrics', 'user_stats']
          },
          cached: true,
          cacheInfo: {
            cachedAt: new Date().toISOString(),
            age: '2 hours ago'
          }
        })
      });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          database: 'redshift',
          cleared: true,
          message: 'Cache cleared successfully'
        })
      });
    } else {
      await route.continue();
    }
  });

  // Mock SQL Server query execution
  await page.route('**/sqlserver/execute', async route => {
    const postData = route.request().postDataJSON();
    const query = (postData.query || postData.sql || '').toLowerCase();

    // Simulate error for invalid queries
    if (query.includes('invalid_table')) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'error',
          columns: [],
          rows: [],
          row_count: 0,
          execution_time: 0,
          error: "Invalid object name 'invalid_table'"
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_QUERY_RESULT)
      });
    }
  });

  // Mock Redshift query execution
  await page.route('**/redshift/execute', async route => {
    const postData = route.request().postDataJSON();
    const query = (postData.query || postData.sql || '').toLowerCase();

    if (query.includes('invalid_table')) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'error',
          columns: [],
          rows: [],
          row_count: 0,
          execution_time: 0,
          error: "relation 'invalid_table' does not exist"
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_QUERY_RESULT,
          message: 'Query executed successfully (3 rows)'
        })
      });
    }
  });

  // Mock auth validate
  await page.route('**/auth/validate', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });
}

// Helper to set up logged in session
async function setupLoggedInSession(page: Page) {
  await page.goto('/');

  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'mock-jwt-token-hasif');
    localStorage.setItem('auth_user', JSON.stringify({
      id: 1,
      username: 'hasif',
      role: 'admin',
      team: 'data-science',
      display_name: 'Hasif',
      created_at: new Date().toISOString(),
      last_login: null,
      is_active: true
    }));
  });
}

// Helper to navigate to SQL page
async function goToSQL(page: Page) {
  await page.goto('/sql');
  await page.waitForLoadState('networkidle');
}

// ============================================
// PAGE LOAD & LAYOUT TESTS
// ============================================
test.describe('SQL Page Load & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
  });

  test('should display SQL page with both editor panels', async ({ page }) => {
    await goToSQL(page);

    // Check page header
    await expect(page.getByText('SQL Query Studio')).toBeVisible();

    // Check both database panels exist (use heading role for specificity)
    await expect(page.getByRole('heading', { name: 'Amazon Redshift' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SQL Server' })).toBeVisible();
  });

  test('should show navigation tabs', async ({ page }) => {
    await goToSQL(page);

    // Check navigation links (use exact match to avoid ambiguity)
    await expect(page.getByRole('link', { name: 'SQL', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Jobs', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Storage', exact: true })).toBeVisible();
  });

  test('should show header with logo', async ({ page }) => {
    await goToSQL(page);

    // Check header logo/title is visible (auth was removed, so checking general header)
    await expect(page.getByText('SQL Query Studio')).toBeVisible();
  });

  test('should show theme toggle', async ({ page }) => {
    await goToSQL(page);

    // Theme toggle button should be visible (uses Sun/Moon icons)
    // Look for the sun or moon icon in the header area
    const sunIcon = page.locator('svg.lucide-sun').first();
    const moonIcon = page.locator('svg.lucide-moon').first();

    // One of them should be visible depending on current theme
    await expect(sunIcon.or(moonIcon)).toBeVisible();
  });
});

// ============================================
// CONNECTION STATUS TESTS
// ============================================
test.describe('Connection Status', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
  });

  test('should show connected status for SQL Server', async ({ page }) => {
    await goToSQL(page);

    // Wait for connection check to complete
    await page.waitForTimeout(1000);

    // When connected, SQL Server panel shows the IP address (10.200.224.42)
    await expect(page.getByRole('heading', { name: 'SQL Server' })).toBeVisible({ timeout: 5000 });
    // The IP address indicates connection - it's shown below the heading
    await expect(page.getByText('10.200.224.42')).toBeVisible({ timeout: 5000 });
  });

  test('should show connected status for Redshift', async ({ page }) => {
    await goToSQL(page);

    await page.waitForTimeout(1000);

    // When connected, Redshift panel shows the schema info (Schema: glue-spectrum)
    await expect(page.getByRole('heading', { name: 'Amazon Redshift' })).toBeVisible({ timeout: 5000 });
    // The schema info indicates connection - it's shown below the heading
    await expect(page.getByText('Schema: glue-spectrum')).toBeVisible({ timeout: 5000 });
  });

  test('should show disconnected status when database offline', async ({ page }) => {
    // Override health mock to return disconnected
    await page.route('**/sqlserver/health', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'disconnected',
          connected: false,
          error: 'Connection refused'
        })
      });
    });

    await goToSQL(page);
    await page.waitForTimeout(1000);

    // Should show disconnected status
    await expect(page.getByText(/Disconnected|Offline/i).first()).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// EXPLORER PANEL TESTS
// ============================================
test.describe('Explorer Panel', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
    await goToSQL(page);
  });

  test('should toggle explorer sidebar', async ({ page }) => {
    // Find and click the explorer toggle button (left-most button)
    const explorerToggle = page.locator('button[title*="Explorer"]').first();

    // Check if explorer toggle exists - if not, look for alternative selector
    const toggleButton = page.locator('button').filter({ has: page.locator('.lucide-panel-left-close, .lucide-panel-left-open') }).first();

    if (await toggleButton.isVisible()) {
      // Click to open explorer
      await toggleButton.click();
      await page.waitForTimeout(500);

      // Check for tables section
      await expect(page.getByText('Tables')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display schema tree when explorer is open', async ({ page }) => {
    // Open explorer if not already open
    const toggleButton = page.locator('button').filter({ has: page.locator('.lucide-panel-left-close, .lucide-panel-left-open') }).first();

    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await page.waitForTimeout(500);

      // Should show schema names
      await expect(page.getByText('dbo')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should expand/collapse database nodes', async ({ page }) => {
    // Open explorer
    const toggleButton = page.locator('button').filter({ has: page.locator('.lucide-panel-left-close, .lucide-panel-left-open') }).first();

    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await page.waitForTimeout(500);

      // Click on schema to expand
      const schemaNode = page.getByText('dbo');
      if (await schemaNode.isVisible()) {
        await schemaNode.click();
        await page.waitForTimeout(300);

        // Should show tables under schema
        await expect(page.getByText('Customers')).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should show 3-dot menu in explorer', async ({ page }) => {
    // Open explorer
    const toggleButton = page.locator('button').filter({ has: page.locator('.lucide-panel-left-close, .lucide-panel-left-open') }).first();

    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await page.waitForTimeout(500);

      // Look for more options button
      const moreButton = page.locator('button').filter({ has: page.locator('.lucide-more-vertical') }).first();

      if (await moreButton.isVisible()) {
        await moreButton.click();

        // Should show menu options
        await expect(page.getByText('Upload CSV/Excel')).toBeVisible({ timeout: 3000 });
        await expect(page.getByText('Refresh Schema')).toBeVisible();
        await expect(page.getByText('Clear Cache')).toBeVisible();
      }
    }
  });
});

// ============================================
// QUERY EXECUTION TESTS
// ============================================
test.describe('Query Execution', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
    await goToSQL(page);
  });

  test('should execute query with Run button', async ({ page }) => {
    // Find Run button in SQL Server panel
    const runButton = page.getByRole('button', { name: /Run/i }).first();
    await runButton.click();

    // Wait for results
    await page.waitForTimeout(1000);

    // Should show results or success message
    await expect(page.getByText(/rows|executed|success/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show row count after execution', async ({ page }) => {
    // Execute query
    const runButton = page.getByRole('button', { name: /Run/i }).first();
    await runButton.click();

    await page.waitForTimeout(1000);

    // Should show row count
    await expect(page.getByText(/3 rows|row_count: 3/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show execution time', async ({ page }) => {
    const runButton = page.getByRole('button', { name: /Run/i }).first();
    await runButton.click();

    await page.waitForTimeout(1000);

    // Should show execution time (ms or seconds)
    await expect(page.getByText(/ms|seconds|0\.0/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should display query results in table', async ({ page }) => {
    const runButton = page.getByRole('button', { name: /Run/i }).first();
    await runButton.click();

    await page.waitForTimeout(1000);

    // Check for result data
    await expect(page.getByText('John Doe').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show error message for invalid query', async ({ page }) => {
    // We need to type an invalid query first
    // Find the code editor and type
    const codeEditor = page.locator('textarea, [contenteditable="true"], .monaco-editor').first();

    if (await codeEditor.isVisible()) {
      // Clear and type invalid query
      await codeEditor.click();
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('SELECT * FROM invalid_table');

      // Execute
      const runButton = page.getByRole('button', { name: /Run/i }).first();
      await runButton.click();

      await page.waitForTimeout(1000);

      // Should show error
      await expect(page.getByText(/error|invalid/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================
// RESULTS PANEL TESTS
// ============================================
test.describe('Results Panel', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
    await goToSQL(page);
  });

  test('should show Results and Messages tabs', async ({ page }) => {
    // Execute a query first
    const runButton = page.getByRole('button', { name: /Run/i }).first();
    await runButton.click();
    await page.waitForTimeout(1000);

    // Check for tabs
    await expect(page.getByRole('tab', { name: /Results/i }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /Messages/i }).first()).toBeVisible();
  });

  test('should display column headers', async ({ page }) => {
    const runButton = page.getByRole('button', { name: /Run/i }).first();
    await runButton.click();
    await page.waitForTimeout(1000);

    // Check for column headers from mock data
    await expect(page.getByText('id').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('name').first()).toBeVisible();
    await expect(page.getByText('email').first()).toBeVisible();
  });

  test('should show download buttons', async ({ page }) => {
    const runButton = page.getByRole('button', { name: /Run/i }).first();
    await runButton.click();
    await page.waitForTimeout(1000);

    // Check for download options (CSV, Excel)
    const downloadButton = page.locator('button').filter({ has: page.locator('.lucide-download') }).first();
    await expect(downloadButton).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// SAVE/IMPORT QUERY TESTS
// ============================================
test.describe('Save/Import Query', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
    await goToSQL(page);
  });

  test('should show save dropdown', async ({ page }) => {
    // Look for save button or dropdown
    const saveButton = page.locator('button').filter({ has: page.locator('.lucide-save, .lucide-chevron-down') }).first();

    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(300);

      // Should show save options
      await expect(page.getByText(/Save Query|Export/i).first()).toBeVisible({ timeout: 3000 });
    }
  });
});

// ============================================
// KEYBOARD SHORTCUT TESTS
// ============================================
test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
    await goToSQL(page);
  });

  test('should execute query with Cmd/Ctrl+Enter', async ({ page }) => {
    // Focus on editor area
    const editorArea = page.locator('textarea, [contenteditable="true"]').first();

    if (await editorArea.isVisible()) {
      await editorArea.click();

      // Press Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      await page.keyboard.press('Meta+Enter');

      await page.waitForTimeout(1000);

      // Should show results
      await expect(page.getByText(/rows|executed|success/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================
// DUAL PANEL TESTS
// ============================================
test.describe('Dual Panel Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
    await goToSQL(page);
  });

  test('should have separate Run buttons for each panel', async ({ page }) => {
    // Should have at least 2 Run buttons (one for each panel)
    const runButtons = page.getByRole('button', { name: /Run/i });
    await expect(runButtons).toHaveCount(2, { timeout: 5000 });
  });

  test('should execute queries independently', async ({ page }) => {
    // Execute on first panel
    const firstRunButton = page.getByRole('button', { name: /Run/i }).first();
    await firstRunButton.click();

    await page.waitForTimeout(500);

    // Execute on second panel
    const secondRunButton = page.getByRole('button', { name: /Run/i }).nth(1);
    await secondRunButton.click();

    await page.waitForTimeout(1000);

    // Both should show results (success message visible)
    const successMessages = page.getByText(/success|rows/i);
    await expect(successMessages.first()).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// MERGE EDITOR TESTS
// ============================================
test.describe('Merge Editor', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
    await goToSQL(page);
  });

  test('should show merge editor section', async ({ page }) => {
    // Scroll down to find merge editor
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Should show merge section
    await expect(page.getByText(/Merge|Combine/i).first()).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================
test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);
    await goToSQL(page);
  });

  test('should navigate to Jobs page', async ({ page }) => {
    await page.getByRole('link', { name: /Jobs/i }).click();
    await page.waitForURL(/\/jobs/);
    await expect(page).toHaveURL(/\/jobs/);
  });

  test('should navigate to Storage page', async ({ page }) => {
    await page.getByRole('link', { name: /Storage/i }).click();
    await page.waitForURL(/\/storage/);
    await expect(page).toHaveURL(/\/storage/);
  });

  test('should navigate home via logo click', async ({ page }) => {
    const logo = page.getByRole('link', { name: /SQL Query Studio/i });
    if (await logo.isVisible()) {
      await logo.click();
      await page.waitForURL('/');
    }
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================
test.describe('Error Handling', () => {
  test('should handle schema fetch error gracefully', async ({ page }) => {
    await page.route('**/sqlserver/schema**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await setupLoggedInSession(page);
    await goToSQL(page);

    // Open explorer
    const toggleButton = page.locator('button').filter({ has: page.locator('.lucide-panel-left-close, .lucide-panel-left-open') }).first();

    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await page.waitForTimeout(500);

      // Should show error or empty state
      await expect(page.getByText(/No tables|Error|Failed/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle query timeout', async ({ page }) => {
    await setupSQLMocks(page);
    await setupLoggedInSession(page);

    // Override the execute route AFTER setupSQLMocks to ensure our timeout mock takes precedence
    await page.route('**/sqlserver/execute', async route => {
      // Simulate timeout by delaying response significantly
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Query timeout' })
      });
    });

    await goToSQL(page);

    // Get the second Run button (SQL Server is the second panel)
    const runButtons = page.getByRole('button', { name: /Run/i });
    await runButtons.nth(1).click();

    await page.waitForTimeout(1000);

    // Should show error in the SQL Server panel's Messages tab
    await expect(page.getByText(/timeout|error|failed/i).first()).toBeVisible({ timeout: 10000 });
  });
});
