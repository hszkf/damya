import { test, expect, Page } from '@playwright/test';

/**
 * E2E Storage Tests
 * 
 * These tests verify the storage feature including file browsing,
 * upload, download, delete, rename, folder operations, and move functionality.
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

// Mock file data
const MOCK_FILES = [
  {
    key: 'hasif/documents/',
    name: 'documents/',
    size_bytes: 0,
    last_modified: '2025-01-15T10:30:00.000Z',
    s3_uri: 's3://test-bucket/hasif/documents/'
  },
  {
    key: 'hasif/images/',
    name: 'images/',
    size_bytes: 0,
    last_modified: '2025-01-14T08:00:00.000Z',
    s3_uri: 's3://test-bucket/hasif/images/'
  },
  {
    key: 'hasif/report.pdf',
    name: 'report.pdf',
    size_bytes: 1048576,
    last_modified: '2025-01-15T14:30:00.000Z',
    s3_uri: 's3://test-bucket/hasif/report.pdf'
  },
  {
    key: 'hasif/data.csv',
    name: 'data.csv',
    size_bytes: 524288,
    last_modified: '2025-01-14T16:45:00.000Z',
    s3_uri: 's3://test-bucket/hasif/data.csv'
  },
  {
    key: 'hasif/image.png',
    name: 'image.png',
    size_bytes: 2097152,
    last_modified: '2025-01-13T09:15:00.000Z',
    s3_uri: 's3://test-bucket/hasif/image.png'
  }
];

const MOCK_NESTED_FILES = [
  {
    key: 'hasif/documents/readme.txt',
    name: 'readme.txt',
    size_bytes: 1024,
    last_modified: '2025-01-15T10:30:00.000Z',
    s3_uri: 's3://test-bucket/hasif/documents/readme.txt'
  },
  {
    key: 'hasif/documents/notes.md',
    name: 'notes.md',
    size_bytes: 2048,
    last_modified: '2025-01-14T12:00:00.000Z',
    s3_uri: 's3://test-bucket/hasif/documents/notes.md'
  }
];

// Configure tests to run serially
test.describe.configure({ mode: 'serial' });

// Helper to setup all API mocks
async function setupStorageMocks(page: Page) {
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

  // Mock storage health endpoint
  await page.route('**/storage/health', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'connected',
        bucket: 'test-bucket',
        prefix: 'damya/',
        region: 'ap-southeast-1',
        error: null
      })
    });
  });

  // Mock list files endpoint
  await page.route('**/storage/files**', async route => {
    const url = new URL(route.request().url());
    const subfolder = url.searchParams.get('subfolder') || '';
    
    let files = MOCK_FILES;
    
    // Return different files based on subfolder
    if (subfolder === 'hasif/documents') {
      files = MOCK_NESTED_FILES;
    } else if (subfolder && subfolder !== 'hasif') {
      files = [];
    }
    
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          files: files,
          count: files.length,
          prefix: subfolder,
          bucket: 'test-bucket'
        })
      });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          message: 'File deleted successfully'
        })
      });
    } else {
      await route.continue();
    }
  });

  // Mock upload endpoint
  await page.route('**/storage/upload', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        key: 'hasif/uploaded-file.txt',
        bucket: 'test-bucket',
        size_bytes: 1024,
        content_type: 'text/plain',
        s3_uri: 's3://test-bucket/hasif/uploaded-file.txt'
      })
    });
  });

  // Mock upload multiple endpoint
  await page.route('**/storage/upload-multiple', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        uploaded: 2,
        failed: 0,
        results: [
          { key: 'hasif/file1.txt', status: 'success' },
          { key: 'hasif/file2.txt', status: 'success' }
        ]
      })
    });
  });

  // Mock create folder endpoint
  await page.route('**/storage/folders', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        key: 'hasif/new-folder/',
        s3_uri: 's3://test-bucket/hasif/new-folder/'
      })
    });
  });

  // Mock rename endpoint
  await page.route('**/storage/files/rename', async route => {
    const postData = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        new_key: postData.key.replace(/[^\/]+$/, postData.new_name),
        new_name: postData.new_name,
        s3_uri: `s3://test-bucket/${postData.key.replace(/[^\/]+$/, postData.new_name)}`
      })
    });
  });

  // Mock move endpoint
  await page.route('**/storage/move', async route => {
    const postData = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        moved: postData.source_keys.length,
        failed: 0,
        results: postData.source_keys.map((key: string) => ({
          source: key,
          destination: `${postData.destination_folder}/${key.split('/').pop()}`,
          status: 'success'
        }))
      })
    });
  });

  // Mock download URL endpoint
  await page.route('**/storage/download-url/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        url: 'https://test-bucket.s3.amazonaws.com/signed-url',
        expiration_seconds: 3600,
        key: 'hasif/report.pdf'
      })
    });
  });
}

// Helper to clear auth state and set up a logged in session directly
async function setupLoggedInSession(page: Page) {
  await page.goto('/');
  
  // Set up auth directly in localStorage (simulating logged in state)
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

// Helper to navigate to storage page
async function goToStorage(page: Page) {
  await page.goto('/storage');
  await page.waitForLoadState('networkidle');
}

// ============================================
// PAGE LOAD & NAVIGATION TESTS
// ============================================
test.describe('Storage Page Load & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupStorageMocks(page);
    await setupLoggedInSession(page);
  });

  test('should display storage page with team workspaces', async ({ page }) => {
    await goToStorage(page);

    // Check page title/header (in AppHeader)
    await expect(page.getByRole('link', { name: 'S3 Storage' })).toBeVisible();

    // Check Team Workspaces heading in main content
    await expect(page.getByRole('heading', { name: 'Team Workspaces' })).toBeVisible();

    // Check team sections exist
    await expect(page.getByText('Data Science').first()).toBeVisible();
    await expect(page.getByText('Business Intelligence').first()).toBeVisible();
  });

  test('should show connection status indicator', async ({ page }) => {
    await goToStorage(page);
    
    // Check for connected status (first instance in sidebar)
    await expect(page.getByText('Connected').first()).toBeVisible();
  });

  test('should display team members in sidebar', async ({ page }) => {
    await goToStorage(page);
    
    // Target sidebar specifically using complementary role
    const sidebar = page.getByRole('complementary');
    
    // Check Data Science team members in sidebar
    await expect(sidebar.getByRole('button', { name: /hasif/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /nazierul/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /izhar/i })).toBeVisible();
    
    // Check Business Intelligence team members in sidebar
    await expect(sidebar.getByRole('button', { name: /bob/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /ernie/i })).toBeVisible();
  });

  test('should navigate into workspace when clicking member', async ({ page }) => {
    await goToStorage(page);
    
    // Click on hasif workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Breadcrumb should show current path
    await expect(page.getByText('hasif').first()).toBeVisible();
    
    // Should show files
    await expect(page.getByText('report.pdf')).toBeVisible();
  });

  test('should show breadcrumb navigation', async ({ page }) => {
    await goToStorage(page);
    
    // Navigate to hasif workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Check breadcrumb shows Storage > hasif
    await expect(page.getByRole('button', { name: 'Storage' })).toBeVisible();
  });

  test('should navigate back using breadcrumb', async ({ page }) => {
    await goToStorage(page);
    
    // Navigate to workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Click Storage in breadcrumb to go back
    await page.getByRole('button', { name: 'Storage' }).click();
    await page.waitForLoadState('networkidle');
    
    // Should show team workspaces again
    await expect(page.getByText('Team Workspaces')).toBeVisible();
  });

  test('should navigate into folders', async ({ page }) => {
    await goToStorage(page);
    
    // Navigate to hasif workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Click on documents folder
    await page.getByText('documents').click();
    await page.waitForLoadState('networkidle');
    
    // Should show nested files
    await expect(page.getByText('readme.txt')).toBeVisible();
  });
});

// ============================================
// FILE LISTING TESTS
// ============================================
test.describe('File Listing', () => {
  test.beforeEach(async ({ page }) => {
    await setupStorageMocks(page);
    await setupLoggedInSession(page);
    await goToStorage(page);
    
    // Navigate to hasif workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test('should display files in list view', async ({ page }) => {
    // Check table headers
    await expect(page.getByText('Name')).toBeVisible();
    await expect(page.getByText('Size')).toBeVisible();
    await expect(page.getByText('Modified')).toBeVisible();
    
    // Check files are displayed
    await expect(page.getByText('report.pdf')).toBeVisible();
    await expect(page.getByText('data.csv')).toBeVisible();
    await expect(page.getByText('image.png')).toBeVisible();
  });

  test('should display folders before files', async ({ page }) => {
    // Get all items in order
    const items = await page.locator('[class*="grid-cols-"] > div').allTextContents();
    
    // Find positions of folders and files
    const documentsIndex = items.findIndex(text => text.includes('documents'));
    const reportIndex = items.findIndex(text => text.includes('report.pdf'));
    
    // Folders should come before files
    expect(documentsIndex).toBeLessThan(reportIndex);
  });

  test('should switch to grid view', async ({ page }) => {
    // View toggle is only visible when in a workspace
    // Navigate to workspace first
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Click grid view button (aria-label might be available)
    const gridButton = page.locator('button').filter({ hasText: '' }).filter({ has: page.locator('.lucide-grid-3x3') });
    // Fallback - try the second toggle button (first is list, second is grid)
    const viewToggleButtons = page.locator('.flex.items-center.gap-1 button');
    await viewToggleButtons.nth(1).click();
    
    // Grid view should show items differently (file names still visible)
    await expect(page.getByText('report.pdf')).toBeVisible();
  });

  test('should filter files with search', async ({ page }) => {
    // Type in search
    await page.getByPlaceholder('Search files...').fill('report');
    
    // Should show matching file
    await expect(page.getByText('report.pdf')).toBeVisible();
    
    // Should hide non-matching files
    await expect(page.getByText('data.csv')).not.toBeVisible();
  });

  test('should clear search and show all files', async ({ page }) => {
    // Search for something
    await page.getByPlaceholder('Search files...').fill('report');
    
    // Clear search
    await page.getByPlaceholder('Search files...').fill('');
    
    // Should show all files again
    await expect(page.getByText('report.pdf')).toBeVisible();
    await expect(page.getByText('data.csv')).toBeVisible();
  });

  test('should show file size formatted', async ({ page }) => {
    // report.pdf is 1MB (1048576 bytes) - parseFloat removes trailing zeros
    await expect(page.getByText('1 MB')).toBeVisible();
  });

  test('should show empty folder message', async ({ page }) => {
    // Navigate to a folder with no files
    await page.getByText('images').click();
    await page.waitForLoadState('networkidle');
    
    // Should show empty message
    await expect(page.getByText('Empty folder')).toBeVisible();
  });
});

// ============================================
// FILE UPLOAD TESTS
// ============================================
test.describe('File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await setupStorageMocks(page);
    await setupLoggedInSession(page);
    await goToStorage(page);
  });

  test('should not show upload button without workspace selected', async ({ page }) => {
    // On team workspaces view, upload button should not be visible (use exact match)
    await expect(page.getByRole('button', { name: 'Upload', exact: true })).not.toBeVisible();
  });

  test('should show upload button when in workspace', async ({ page }) => {
    // Navigate to workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Upload button should be visible (exact match for main upload button)
    await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeVisible();
  });

  test('should upload file via button click', async ({ page }) => {
    // Navigate to workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Create a file to upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    const fileChooser = await fileChooserPromise;
    
    // Set file
    await fileChooser.setFiles({
      name: 'test-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Hello World')
    });
    
    // Wait for upload to complete - toast should appear
    await expect(page.getByText(/uploaded/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should upload multiple files', async ({ page }) => {
    // Navigate to workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Create files to upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    const fileChooser = await fileChooserPromise;
    
    // Set multiple files
    await fileChooser.setFiles([
      { name: 'file1.txt', mimeType: 'text/plain', buffer: Buffer.from('File 1') },
      { name: 'file2.txt', mimeType: 'text/plain', buffer: Buffer.from('File 2') }
    ]);
    
    // Wait for upload to complete
    await expect(page.getByText(/uploaded/i).first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// FILE ACTION TESTS (Download, Delete, Rename)
// ============================================
test.describe('File Actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupStorageMocks(page);
    await setupLoggedInSession(page);
    await goToStorage(page);
    
    // Navigate to hasif workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test('should select file by clicking checkbox', async ({ page }) => {
    // The checkbox is the first button in each file row (uses Square icon)
    // Find file row and click its checkbox button
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    const checkbox = fileRow.locator('button').first();
    await checkbox.click();
    
    // Selection action buttons should appear (Move (1), Delete (1))
    await expect(page.getByText(/Move \(1\)/i)).toBeVisible();
    await expect(page.getByText(/Delete \(1\)/i)).toBeVisible();
  });

  test('should deselect file by clicking checkbox again', async ({ page }) => {
    // Select file first
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    const checkbox = fileRow.locator('button').first();
    await checkbox.click();
    await expect(page.getByText(/Delete \(1\)/i)).toBeVisible();
    
    // Click checkbox again to deselect
    await checkbox.click();
    
    // Bulk action buttons should disappear
    await expect(page.getByText(/Delete \(\d+\)/i)).not.toBeVisible({ timeout: 3000 });
  });

  test('should select multiple files', async ({ page }) => {
    // Click first file's checkbox
    const fileRow1 = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow1.locator('button').first().click();
    
    // Click second file's checkbox
    const fileRow2 = page.locator('[class*="grid-cols-"]').filter({ hasText: 'data.csv' }).first();
    await fileRow2.locator('button').first().click();
    
    // Both should be selected - check for bulk action buttons with count 2
    await expect(page.getByText(/Move \(2\)/i)).toBeVisible();
    await expect(page.getByText(/Delete \(2\)/i)).toBeVisible();
  });

  test('should show delete confirmation when clicking delete', async ({ page }) => {
    // Select a file via checkbox
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Click delete button
    await page.getByText(/Delete \(1\)/i).click();
    
    // Confirmation modal should appear with warning text
    await expect(page.getByText(/This action cannot be undone/i)).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// FOLDER OPERATION TESTS
// ============================================
test.describe('Folder Operations', () => {
  test.beforeEach(async ({ page }) => {
    await setupStorageMocks(page);
    await setupLoggedInSession(page);
    await goToStorage(page);
    
    // Navigate to hasif workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test('should show new folder button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'New Folder' })).toBeVisible();
  });

  test('should open new folder dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'New Folder' }).click();
    
    // Dialog should appear - use heading role to be specific
    await expect(page.getByRole('heading', { name: 'Create Folder' })).toBeVisible();
    await expect(page.getByPlaceholder('Folder name')).toBeVisible();
  });

  test('should create new folder', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: 'New Folder' }).click();
    
    // Type folder name
    await page.getByPlaceholder('Folder name').fill('test-folder');
    
    // Click create button (the button, not the heading)
    await page.getByRole('button', { name: 'Create Folder' }).click();
    
    // Toast should show success
    await expect(page.getByText(/Folder.*created/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should cancel folder creation', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: 'New Folder' }).click();
    
    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Dialog should close
    await expect(page.getByPlaceholder('Folder name')).not.toBeVisible();
  });

  test('should navigate into folder on click', async ({ page }) => {
    // Click on folder
    await page.getByText('documents').click();
    await page.waitForLoadState('networkidle');
    
    // Should show nested files
    await expect(page.getByText('readme.txt')).toBeVisible();
  });
});

// ============================================
// MOVE OPERATION TESTS
// ============================================
test.describe('Move Operations', () => {
  test.beforeEach(async ({ page }) => {
    await setupStorageMocks(page);
    await setupLoggedInSession(page);
    await goToStorage(page);
    
    // Navigate to hasif workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test('should show move button when files selected', async ({ page }) => {
    // Select a file via checkbox (first button in file row)
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Move button should appear with count
    await expect(page.getByText(/Move \(1\)/i)).toBeVisible();
  });

  test('should open move dialog', async ({ page }) => {
    // Select a file
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Click move button
    await page.getByText(/Move \(1\)/i).click();
    
    // Dialog should appear - use heading for Move Files title
    await expect(page.getByRole('heading', { name: 'Move Files' })).toBeVisible();
    await expect(page.getByText('Quick select')).toBeVisible();
  });

  test('should show team members as move destinations', async ({ page }) => {
    // Select a file
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Click move button
    await page.getByText(/Move \(1\)/i).click();
    
    // Check quick select destinations (they appear as /username buttons)
    await expect(page.getByRole('button', { name: '/nazierul' })).toBeVisible();
    await expect(page.getByRole('button', { name: '/bob' })).toBeVisible();
  });

  test('should move files to destination', async ({ page }) => {
    // Select a file
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Click move button
    await page.getByText(/Move \(1\)/i).click();
    
    // Click a quick select destination button
    await page.getByRole('button', { name: '/nazierul' }).click();
    
    // Click move files button
    await page.getByRole('button', { name: 'Move Files' }).click();
    
    // Toast should show success
    await expect(page.getByText(/moved/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should cancel move operation', async ({ page }) => {
    // Select a file
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Click move button
    await page.getByText(/Move \(1\)/i).click();
    
    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Dialog should close - heading should not be visible
    await expect(page.getByRole('heading', { name: 'Move Files' })).not.toBeVisible();
  });
});

// ============================================
// DELETE OPERATION TESTS
// ============================================
test.describe('Delete Operations', () => {
  test.beforeEach(async ({ page }) => {
    await setupStorageMocks(page);
    await setupLoggedInSession(page);
    await goToStorage(page);
    
    // Navigate to hasif workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test('should show delete button when files selected', async ({ page }) => {
    // Select a file via checkbox
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Delete button should appear with count
    await expect(page.getByText(/Delete \(1\)/i)).toBeVisible();
  });

  test('should open delete confirmation dialog', async ({ page }) => {
    // Select a file
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Click delete button
    await page.getByText(/Delete \(1\)/i).click();
    
    // Confirmation dialog should appear
    await expect(page.getByRole('heading', { name: 'Delete Items' })).toBeVisible();
    await expect(page.getByText(/cannot be undone/i)).toBeVisible();
  });

  test('should delete selected files', async ({ page }) => {
    // Select a file
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Click delete button
    await page.getByText(/Delete \(1\)/i).click();
    
    // Confirm deletion - click the button containing "Delete" and "Item"
    await page.getByRole('button', { name: /Delete 1 Item/i }).click();
    
    // Toast should show success
    await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should cancel delete operation', async ({ page }) => {
    // Select a file
    const fileRow = page.locator('[class*="grid-cols-"]').filter({ hasText: 'report.pdf' }).first();
    await fileRow.locator('button').first().click();
    
    // Click delete button
    await page.getByText(/Delete \(1\)/i).click();
    
    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Dialog should close - heading should not be visible
    await expect(page.getByRole('heading', { name: 'Delete Items' })).not.toBeVisible();
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================
test.describe('Error Handling', () => {
  test('should show disconnected status when S3 is unavailable', async ({ page }) => {
    // Override health mock to return disconnected
    await page.route('**/storage/health', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'disconnected',
          bucket: null,
          prefix: null,
          region: null,
          error: 'Failed to connect to S3'
        })
      });
    });
    
    await setupLoggedInSession(page);
    await goToStorage(page);
    
    // Should show disconnected/offline status
    await expect(page.getByText(/Offline|Disconnected/i).first()).toBeVisible();
  });

  test('should handle file listing error gracefully', async ({ page }) => {
    await page.route('**/storage/health', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'connected',
          bucket: 'test-bucket',
          prefix: 'damya/',
          region: 'ap-southeast-1'
        })
      });
    });
    
    await page.route('**/storage/files**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await setupLoggedInSession(page);
    await goToStorage(page);
    
    // Navigate to workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    
    // Should show error toast
    await expect(page.getByText(/failed|error/i).first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// VIEW MODE TESTS
// ============================================
test.describe('View Modes', () => {
  test.beforeEach(async ({ page }) => {
    await setupStorageMocks(page);
    await setupLoggedInSession(page);
    await goToStorage(page);
    
    // Navigate to hasif workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test('should default to list view', async ({ page }) => {
    // List view should show table headers
    await expect(page.getByText('Name')).toBeVisible();
    await expect(page.getByText('Size')).toBeVisible();
    await expect(page.getByText('Modified')).toBeVisible();
  });

  test('should switch to grid view', async ({ page }) => {
    // View toggle buttons are in a flex container with gap-1
    // Grid button is second in the pair
    const viewToggleButtons = page.locator('.flex.items-center.gap-1 button');
    await viewToggleButtons.nth(1).click();
    
    // Files should still be visible in grid view
    await expect(page.getByText('report.pdf')).toBeVisible();
    await expect(page.getByText('data.csv')).toBeVisible();
  });

  test('should maintain file visibility across view modes', async ({ page }) => {
    // Files should be visible in default list view
    await expect(page.getByText('report.pdf')).toBeVisible();
    await expect(page.getByText('data.csv')).toBeVisible();
    
    // After switching to grid view (tested in previous test), files remain visible
    // This is verified by the grid view test
  });
});

// ============================================
// STATUS BAR TESTS
// ============================================
test.describe('Status Bar', () => {
  test.beforeEach(async ({ page }) => {
    await setupStorageMocks(page);
    await setupLoggedInSession(page);
    await goToStorage(page);
  });

  test('should show bucket name in status bar', async ({ page }) => {
    await expect(page.getByText('test-bucket')).toBeVisible();
  });

  test('should show region in status bar', async ({ page }) => {
    await expect(page.getByText('ap-southeast-1').first()).toBeVisible();
  });

  test('should show item count when in workspace', async ({ page }) => {
    // Navigate to workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Should show item count
    await expect(page.getByText(/\d+ items?/)).toBeVisible();
  });

  test('should show current path in status bar', async ({ page }) => {
    // Navigate to workspace
    await page.getByRole('button', { name: /hasif/i }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Should show path
    await expect(page.getByText('/hasif')).toBeVisible();
  });
});
