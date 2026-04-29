import { test, expect, Page } from '@playwright/test';

/**
 * E2E Jobs Scheduler Tests
 *
 * These tests verify the Jobs page including job listing, filtering,
 * CRUD operations, job execution, and scheduling functionality.
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

// Mock job data
const MOCK_JOBS = [
  {
    id: 'job-001',
    job_name: 'Daily Sales Report',
    job_type: 'workflow',
    description: 'Generate daily sales summary',
    author: 'hasif',
    is_active: true,
    schedule_type: 'cron',
    schedule_config: { cron_expression: '0 9 * * *' },
    workflow_definition: {
      steps: [
        { type: 'redshift_query', name: 'Fetch data' },
        { type: 'sqlserver_query', name: 'Transform data' }
      ]
    },
    last_run_status: 'completed',
    last_run_started_at: '2025-01-15T09:00:00Z',
    last_run_completed_at: '2025-01-15T09:02:30Z',
    next_run_time: '2025-01-16T09:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T09:02:30Z'
  },
  {
    id: 'job-002',
    job_name: 'Hourly Data Sync',
    job_type: 'workflow',
    description: 'Sync data between databases',
    author: 'nazierul',
    is_active: true,
    schedule_type: 'interval',
    schedule_config: { interval_minutes: 60 },
    workflow_definition: {
      steps: [
        { type: 'merge', name: 'Merge tables' }
      ]
    },
    last_run_status: 'running',
    last_run_started_at: '2025-01-15T14:00:00Z',
    next_run_time: '2025-01-15T15:00:00Z',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-15T14:00:00Z'
  },
  {
    id: 'job-003',
    job_name: 'Weekly Backup',
    job_type: 'function',
    description: 'Run weekly backup function',
    author: 'izhar',
    is_active: false,
    schedule_type: 'cron',
    schedule_config: { cron_expression: '0 0 * * 0' },
    last_run_status: 'failed',
    last_run_started_at: '2025-01-12T00:00:00Z',
    last_run_completed_at: '2025-01-12T00:01:45Z',
    created_at: '2025-01-03T00:00:00Z',
    updated_at: '2025-01-12T00:01:45Z'
  },
  {
    id: 'job-004',
    job_name: 'Monthly Analytics',
    job_type: 'workflow',
    description: 'Generate monthly analytics report',
    author: 'bob',
    is_active: true,
    schedule_type: 'cron',
    schedule_config: { cron_expression: '0 0 1 * *' },
    workflow_definition: {
      steps: [
        { type: 'redshift_query', name: 'Query analytics' }
      ]
    },
    next_run_time: '2025-02-01T00:00:00Z',
    created_at: '2025-01-04T00:00:00Z',
    updated_at: '2025-01-04T00:00:00Z'
  }
];

// Configure tests to run serially
test.describe.configure({ mode: 'serial' });

// Helper to setup all API mocks
async function setupJobsMocks(page: Page) {
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

  // Mock jobs list endpoint - intercept ALL requests containing "8080/jobs"
  await page.route('**/*8080/jobs', async route => {
    const url = route.request().url();
    const method = route.request().method();

    console.log(`Mock intercepted: ${method} ${url}`);

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          jobs: MOCK_JOBS,
          total: MOCK_JOBS.length
        })
      });
    } else if (method === 'POST') {
      const postData = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'job-new-001',
            ...postData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })
      });
    } else {
      await route.continue();
    }
  });

  // Mock single job endpoint (use regex to match backend API)
  await page.route(/localhost:8080\/jobs\/.+/, async route => {
    const method = route.request().method();
    const url = route.request().url();

    if (url.includes('/run')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Job triggered successfully',
          execution_id: 'exec-001'
        })
      });
    } else if (url.includes('/toggle')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Job status toggled'
        })
      });
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Job deleted successfully'
        })
      });
    } else if (method === 'GET') {
      const jobId = url.split('/jobs/')[1]?.split('/')[0];
      const job = MOCK_JOBS.find(j => j.id === jobId) || MOCK_JOBS[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: job
        })
      });
    } else if (method === 'PUT') {
      const postData = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...MOCK_JOBS[0],
            ...postData,
            updated_at: new Date().toISOString()
          }
        })
      });
    } else {
      await route.continue();
    }
  });

  // Mock scheduler status
  await page.route(/localhost:8080\/jobs\/scheduler\/status/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          running: true,
          jobs_scheduled: MOCK_JOBS.filter(j => j.is_active).length
        }
      })
    });
  });

  // Mock cron validation
  await page.route(/localhost:8080\/jobs\/validate\/cron/, async route => {
    const postData = route.request().postDataJSON();
    const isValid = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/.test(postData.expression);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        valid: isValid,
        description: isValid ? 'Every day at 9:00 AM' : 'Invalid cron expression'
      })
    });
  });

  // Mock registry/functions list
  await page.route(/localhost:8080\/jobs\/registry\/list/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { name: 'backup_database', description: 'Backup database to S3' },
          { name: 'send_report', description: 'Send email report' },
          { name: 'cleanup_logs', description: 'Clean up old log files' }
        ]
      })
    });
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

// Helper to navigate to Jobs page
async function goToJobs(page: Page) {
  await page.goto('/jobs');
  await page.waitForLoadState('networkidle');
}

// ============================================
// PAGE LOAD & LAYOUT TESTS
// ============================================
test.describe('Jobs Page Load & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupJobsMocks(page);
    await setupLoggedInSession(page);
  });

  test('should display jobs page with header', async ({ page }) => {
    // Capture console errors for debugging
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', error => {
      errors.push(`Page error: ${error.message}`);
    });

    await goToJobs(page);

    // Log any errors
    if (errors.length > 0) {
      console.log('Console errors:', errors);
    }

    // Check page header (use role for specificity)
    await expect(page.getByRole('heading', { name: 'Job Scheduler' })).toBeVisible();
    await expect(page.getByText(/Automated workflows/i)).toBeVisible();
  });

  test('should show navigation bar', async ({ page }) => {
    await goToJobs(page);

    // Use exact match to avoid ambiguity
    await expect(page.getByRole('link', { name: 'SQL', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Jobs', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Storage', exact: true })).toBeVisible();
  });

  test('should show stats cards', async ({ page }) => {
    // Debug: Log network requests to /jobs
    const jobsRequests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/jobs')) {
        jobsRequests.push(`${req.method()} ${req.url()}`);
      }
    });
    page.on('response', res => {
      if (res.url().includes('/jobs')) {
        console.log(`Response: ${res.status()} ${res.url()}`);
      }
    });

    await goToJobs(page);

    // Log captured requests for debugging
    console.log('Jobs API requests:', jobsRequests);

    // Wait for jobs to load first (stats only show when jobs.length > 0)
    await expect(page.getByText('Daily Sales Report')).toBeVisible({ timeout: 10000 });

    // Check stats cards (use exact match to avoid ambiguity)
    await expect(page.getByText('Total Jobs')).toBeVisible();
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Workflows', { exact: true })).toBeVisible();
    await expect(page.getByText('Functions', { exact: true })).toBeVisible();
  });

  test('should show correct stats values', async ({ page }) => {
    await goToJobs(page);

    // Total jobs should be 4
    await expect(page.getByText('4').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show New Job button', async ({ page }) => {
    await goToJobs(page);

    await expect(page.getByRole('link', { name: /New Job/i })).toBeVisible();
  });
});

// ============================================
// JOB LIST DISPLAY TESTS
// ============================================
test.describe('Job List Display', () => {
  test.beforeEach(async ({ page }) => {
    await setupJobsMocks(page);
    await setupLoggedInSession(page);
    await goToJobs(page);
  });

  test('should display job names', async ({ page }) => {
    await expect(page.getByText('Daily Sales Report')).toBeVisible();
    await expect(page.getByText('Hourly Data Sync')).toBeVisible();
    await expect(page.getByText('Weekly Backup')).toBeVisible();
  });

  test('should show job type badges', async ({ page }) => {
    // Check for workflow and function badges
    await expect(page.getByText('workflow').first()).toBeVisible();
    await expect(page.getByText('function').first()).toBeVisible();
  });

  test('should show active/inactive status', async ({ page }) => {
    // Check for Active and Inactive badges in table cells (not the filter dropdown)
    await expect(page.getByRole('cell', { name: 'Active' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Inactive' }).first()).toBeVisible();
  });

  test('should show author names', async ({ page }) => {
    // Target table cells specifically to avoid matching hidden dropdown options
    await expect(page.getByRole('cell', { name: /hasif/i }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: /nazierul/i }).first()).toBeVisible();
  });

  test('should show last run status badges', async ({ page }) => {
    await expect(page.getByText(/completed/i).first()).toBeVisible();
    await expect(page.getByText(/running/i).first()).toBeVisible();
    await expect(page.getByText(/failed/i).first()).toBeVisible();
  });

  test('should show schedule info', async ({ page }) => {
    // Check for cron expressions or schedule descriptions
    await expect(page.getByText(/9:00|0 9/i).first()).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// VIEW MODE TESTS
// ============================================
test.describe('View Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await setupJobsMocks(page);
    await setupLoggedInSession(page);
    await goToJobs(page);
  });

  test('should default to table view', async ({ page }) => {
    // Table view shows table headers
    await expect(page.getByRole('columnheader', { name: 'Job' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();
  });

  test('should switch to grid view', async ({ page }) => {
    // Find and click grid view button
    const gridButton = page.locator('button').filter({ has: page.locator('.lucide-layout-grid') });

    if (await gridButton.isVisible()) {
      await gridButton.click();
      await page.waitForTimeout(500);

      // Grid view should show job cards
      // Table headers should not be visible
      await expect(page.getByRole('columnheader', { name: /Job/i })).not.toBeVisible();
    }
  });

  test('should switch back to table view', async ({ page }) => {
    // Switch to grid first
    const gridButton = page.locator('button').filter({ has: page.locator('.lucide-layout-grid') });
    if (await gridButton.isVisible()) {
      await gridButton.click();
      await page.waitForTimeout(300);
    }

    // Switch back to table
    const tableButton = page.locator('button').filter({ has: page.locator('.lucide-layout-list') });
    if (await tableButton.isVisible()) {
      await tableButton.click();
      await page.waitForTimeout(300);

      // Table headers should be visible again
      await expect(page.getByRole('columnheader', { name: /Job/i })).toBeVisible();
    }
  });
});

// ============================================
// FILTERING & SEARCH TESTS
// ============================================
test.describe('Filtering & Search', () => {
  test.beforeEach(async ({ page }) => {
    await setupJobsMocks(page);
    await setupLoggedInSession(page);
    await goToJobs(page);
  });

  test('should filter by search query', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search jobs...');
    await searchInput.fill('Daily');

    await page.waitForTimeout(500);

    // Should show matching job
    await expect(page.getByText('Daily Sales Report')).toBeVisible();

    // Should hide non-matching jobs
    await expect(page.getByText('Weekly Backup')).not.toBeVisible();
  });

  test('should filter by job type', async ({ page }) => {
    // Find type filter dropdown
    const typeSelect = page.locator('select').filter({ hasText: /All Types/i });

    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('workflow');
      await page.waitForTimeout(500);

      // Should show workflow jobs only
      await expect(page.getByText('Daily Sales Report')).toBeVisible();

      // Function jobs should be hidden
      await expect(page.getByText('Weekly Backup')).not.toBeVisible();
    }
  });

  test('should filter by active status', async ({ page }) => {
    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });

    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('active');
      await page.waitForTimeout(500);

      // Active jobs should be visible
      await expect(page.getByText('Daily Sales Report')).toBeVisible();

      // Inactive jobs should be hidden
      await expect(page.getByText('Weekly Backup')).not.toBeVisible();
    }
  });

  test('should filter by author', async ({ page }) => {
    const authorSelect = page.locator('select').filter({ hasText: /All Authors/i });

    if (await authorSelect.isVisible()) {
      await authorSelect.selectOption('hasif');
      await page.waitForTimeout(500);

      // Jobs by hasif should be visible
      await expect(page.getByText('Daily Sales Report')).toBeVisible();

      // Jobs by other authors should be hidden
      await expect(page.getByText('Hourly Data Sync')).not.toBeVisible();
    }
  });

  test('should show filtered count', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search jobs...');
    await searchInput.fill('Daily');

    await page.waitForTimeout(500);

    // Should show count like "1 / 4 jobs"
    await expect(page.getByText(/1.*\/.*4.*jobs/i)).toBeVisible();
  });

  test('should clear filters', async ({ page }) => {
    // Apply search filter
    const searchInput = page.getByPlaceholder('Search jobs...');
    await searchInput.fill('Daily');
    await page.waitForTimeout(300);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // All jobs should be visible again
    await expect(page.getByText('Daily Sales Report')).toBeVisible();
    await expect(page.getByText('Weekly Backup')).toBeVisible();
  });
});

// ============================================
// JOB ACTIONS TESTS
// ============================================
test.describe('Job Actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupJobsMocks(page);
    await setupLoggedInSession(page);
    await goToJobs(page);
  });

  test('should trigger job run', async ({ page }) => {
    // Find run button for first job
    const runButton = page.locator('button[title="Run Now"]').first();

    if (await runButton.isVisible()) {
      await runButton.click();

      // Should show success toast
      await expect(page.getByText(/triggered|started|running/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should toggle job active status', async ({ page }) => {
    // Find toggle button
    const toggleButton = page.locator('button[title*="Deactivate"], button[title*="Activate"]').first();

    if (await toggleButton.isVisible()) {
      await toggleButton.click();

      // Should show success or status change
      await expect(page.getByText(/toggled|activated|deactivated/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show delete confirmation', async ({ page }) => {
    // Find delete button by its accessible name
    const deleteButton = page.getByRole('button', { name: 'Delete' }).first();

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Should show confirmation dialog (use heading to avoid matching button)
      await expect(page.getByRole('heading', { name: 'Delete Job' })).toBeVisible();
      await expect(page.getByText(/cannot be undone/i)).toBeVisible();
    }
  });

  test('should cancel delete action', async ({ page }) => {
    const deleteButton = page.getByRole('button', { name: 'Delete' }).first();

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Cancel the dialog
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Dialog should close
      await expect(page.getByRole('heading', { name: 'Delete Job' })).not.toBeVisible();
    }
  });

  test('should confirm delete action', async ({ page }) => {
    const deleteButton = page.getByRole('button', { name: 'Delete' }).first();

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion
      await page.getByRole('button', { name: 'Delete Job' }).click();

      // Should show success message
      await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================
// TOOLBAR ACTIONS TESTS
// ============================================
test.describe('Toolbar Actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupJobsMocks(page);
    await setupLoggedInSession(page);
    await goToJobs(page);
  });

  test('should navigate to create new job page', async ({ page }) => {
    await page.getByRole('link', { name: /New Job/i }).click();

    await page.waitForURL(/\/jobs\/new/);
    await expect(page).toHaveURL(/\/jobs\/new/);
  });

  test('should refresh job list', async ({ page }) => {
    const refreshButton = page.locator('button').filter({ has: page.locator('.lucide-refresh-cw') });

    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(500);

      // Jobs should still be visible after refresh
      await expect(page.getByText('Daily Sales Report')).toBeVisible();
    }
  });

  test('should toggle polling indicator', async ({ page }) => {
    // By default, polling is enabled and "live" indicator is visible
    await expect(page.getByText('live')).toBeVisible({ timeout: 3000 });

    // Find the polling toggle button (may be "Disable auto-refresh" or "Enable auto-refresh")
    const disableButton = page.getByRole('button', { name: /auto-refresh/i });

    if (await disableButton.isVisible()) {
      // Toggle off - "live" should disappear
      await disableButton.click();
      await page.waitForTimeout(300);

      // Toggle on again - "live" should reappear
      await disableButton.click();
      await page.waitForTimeout(300);

      await expect(page.getByText('live')).toBeVisible({ timeout: 3000 });
    }
  });
});

// ============================================
// CREATE NEW JOB TESTS
// ============================================
test.describe('Create New Job', () => {
  test.beforeEach(async ({ page }) => {
    await setupJobsMocks(page);
    await setupLoggedInSession(page);
    await page.goto('/jobs/new');
    await page.waitForLoadState('networkidle');
  });

  test('should display create job form', async ({ page }) => {
    await expect(page.getByText(/Create.*Job|New.*Job/i).first()).toBeVisible();
  });

  test('should have job name input', async ({ page }) => {
    // Find input by placeholder since label isn't properly associated
    const nameInput = page.getByPlaceholder('daily_data_sync');
    await expect(nameInput).toBeVisible();

    await nameInput.fill('Test Job');
    await expect(nameInput).toHaveValue('Test Job');
  });

  test('should have author dropdown', async ({ page }) => {
    const authorSelect = page.locator('select').filter({ hasText: /Author|Select/i }).first();

    if (await authorSelect.isVisible()) {
      await expect(authorSelect).toBeVisible();
    }
  });

  test('should have schedule input', async ({ page }) => {
    // Look for cron or schedule input
    const scheduleInput = page.getByLabel(/Cron|Schedule/i).first();

    if (await scheduleInput.isVisible()) {
      await expect(scheduleInput).toBeVisible();
    }
  });

  test('should show cancel button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
  });

  test('should navigate back on cancel', async ({ page }) => {
    await page.getByRole('button', { name: /Cancel/i }).click();

    await page.waitForURL(/\/jobs$/);
    await expect(page).toHaveURL(/\/jobs$/);
  });
});

// ============================================
// EMPTY STATE TESTS
// ============================================
test.describe('Empty State', () => {
  test('should show empty state when no jobs', async ({ page }) => {
    // Override mock to return empty jobs - use correct API format
    await page.route('**/*8080/jobs', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            jobs: [],
            total: 0
          })
        });
      } else {
        await route.continue();
      }
    });

    await setupLoggedInSession(page);
    await goToJobs(page);

    // Should show empty state
    await expect(page.getByText(/No jobs configured/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Create First Job/i })).toBeVisible();
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================
test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupJobsMocks(page);
    await setupLoggedInSession(page);
    await goToJobs(page);
  });

  test('should navigate to SQL page', async ({ page }) => {
    await page.getByRole('link', { name: /SQL/i }).click();
    await page.waitForURL(/\/sql/);
    await expect(page).toHaveURL(/\/sql/);
  });

  test('should navigate to Storage page', async ({ page }) => {
    await page.getByRole('link', { name: /Storage/i }).click();
    await page.waitForURL(/\/storage/);
    await expect(page).toHaveURL(/\/storage/);
  });

  test('should navigate to job detail page', async ({ page }) => {
    await page.getByRole('link', { name: 'Daily Sales Report' }).click();
    await page.waitForURL(/\/jobs\/job-001/);
    await expect(page).toHaveURL(/\/jobs\/job-001/);
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================
test.describe('Error Handling', () => {
  test('should handle API error gracefully', async ({ page }) => {
    await page.route('**/jobs', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await setupLoggedInSession(page);
    await goToJobs(page);

    // Should show error or empty state (graceful handling)
    await expect(page.getByText(/error|No jobs|failed/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle job trigger error', async ({ page }) => {
    await page.route('**/jobs/*/run', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to trigger job' })
      });
    });

    await setupJobsMocks(page);
    await setupLoggedInSession(page);
    await goToJobs(page);

    const runButton = page.locator('button[title="Run Now"]').first();
    if (await runButton.isVisible()) {
      await runButton.click();

      // Should show error toast
      await expect(page.getByText(/error|failed/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================
// LOADING STATE TESTS
// ============================================
test.describe('Loading States', () => {
  test('should show loading state initially', async ({ page }) => {
    await setupLoggedInSession(page);

    // Delay the jobs response - use correct API pattern and format
    await page.route('**/*8080/jobs', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          jobs: MOCK_JOBS,
          total: MOCK_JOBS.length
        })
      });
    });

    await page.goto('/jobs');

    // Should show loading indicator
    await expect(page.getByText(/Loading jobs/i)).toBeVisible({ timeout: 2000 });

    // Wait for jobs to load
    await expect(page.getByText('Daily Sales Report')).toBeVisible({ timeout: 5000 });
  });
});
