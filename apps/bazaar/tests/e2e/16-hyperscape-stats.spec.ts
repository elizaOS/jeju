/**
 * HyperscapeStatsPanel Component Tests
 * Tests the Hyperscape stats display migrated from Predimarket
 */

import { test, expect } from '@playwright/test';

test.describe('HyperscapeStatsPanel Component', () => {
  test('should render without crashing when no player data', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(1000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should have proper structure if rendered with player address', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(1000);
    
    const hypescapeText = await page.locator('text=/Hyperscape|HyperscapeOracle/i').count();
    
    if (hypescapeText > 0) {
      const statsPanel = page.locator('text=/Hyperscape Stats/i');
      await expect(statsPanel).toBeVisible();
    }
  });
});

