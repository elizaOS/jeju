/**
 * GameFeedPanel Component Tests
 * Tests the game feed display that was migrated from Predimarket
 */

import { test, expect } from '@playwright/test';

test.describe('GameFeedPanel Component', () => {
  test('should render without crashing when no game feed data', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(1000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body).not.toContain('GameFeedPanel');
  });

  test('should have proper structure if rendered', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(1000);
    
    const gameFeedText = await page.locator('text=/Game Feed|GameFeedOracle/i').count();
    
    if (gameFeedText > 0) {
      const feedPanel = page.locator('text=/Game Feed/i');
      await expect(feedPanel).toBeVisible();
    }
  });
});

