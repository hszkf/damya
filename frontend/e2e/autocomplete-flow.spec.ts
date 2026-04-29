import { test, expect } from '@playwright/test';

/**
 * Test autocomplete flow: schema -> table -> column
 */
test('autocomplete flow: schema selection shows tables', async ({ page }) => {
  // Set up mock schema cache
  await page.addInitScript(() => {
    const mockSchemaCache = {
      data: {
        status: 'success',
        schemas: {
          redshift: {
            'redshift_customers': ['public_customers', 'public_orders', 'private_data'],
            'redshift_analytics': ['daily_metrics', 'user_stats'],
            'public': ['customers', 'orders', 'products'],
          },
          sqlserver: {}
        }
      },
      timestamp: Date.now()
    };
    localStorage.setItem('sql-schema-cache', JSON.stringify(mockSchemaCache));
  });

  await page.goto('/sql');
  await page.waitForLoadState('networkidle');

  const redshiftEditor = page.locator('textarea').first();
  await redshiftEditor.click();
  await redshiftEditor.fill('');

  // Step 1: Type "red" - should show keywords and schemas
  console.log('\n=== Step 1: Type "red" ===');
  await redshiftEditor.type('red', { delay: 80 });
  await page.waitForTimeout(300);

  const dropdown = page.locator('.absolute.z-50');
  await expect(dropdown).toBeVisible();

  let items = await dropdown.locator('div.flex.items-center.gap-2.px-2').allTextContents();
  console.log('Suggestions:', items);
  expect(items.some(i => i.includes('redshift_customers'))).toBeTruthy();

  // Step 2: Press Tab/Enter to select schema
  console.log('\n=== Step 2: Select schema with Tab ===');
  // Find and click on redshift_customers
  const schemaOption = dropdown.locator('div.flex.items-center', { hasText: 'redshift_customers' }).first();
  await schemaOption.click();

  await page.waitForTimeout(300);

  // Step 3: Check that tables are now showing
  console.log('\n=== Step 3: Tables should appear ===');

  // Dropdown should re-appear with tables
  await expect(dropdown).toBeVisible({ timeout: 2000 });

  items = await dropdown.locator('div.flex.items-center.gap-2.px-2').allTextContents();
  console.log('Table suggestions:', items);

  // Should show tables from redshift_customers schema
  expect(items.some(i => i.includes('public_customers'))).toBeTruthy();
  expect(items.some(i => i.includes('public_orders'))).toBeTruthy();

  // Step 4: Verify editor content
  const editorValue = await redshiftEditor.inputValue();
  console.log('\nEditor value:', editorValue);
  expect(editorValue).toBe('redshift_customers.');

  console.log('\n✅ Autocomplete flow working correctly!');

  // Keep browser open briefly
  await page.waitForTimeout(2000);
});
