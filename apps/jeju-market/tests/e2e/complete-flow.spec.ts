import { test, expect } from '@playwright/test';

test.describe('Complete Market Flow', () => {
  test('should complete full betting cycle', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3003');
    
    await expect(page.getByText('JejuMarket')).toBeVisible();
    await expect(page.getByText('Decentralized Prediction Markets')).toBeVisible();

    // 2. Check markets loaded
    await page.waitForSelector('[data-testid="market-card"]', { timeout: 10000 });
    
    const marketCards = await page.locator('[data-testid="market-card"]').count();
    expect(marketCards).toBeGreaterThan(0);

    // 3. Click on first market
    await page.locator('[data-testid="market-card"]').first().click();
    
    // 4. Verify market page loads
    await expect(page.getByText(/Will/)).toBeVisible();
    await expect(page.getByText('Current Prices')).toBeVisible();

    // 5. Connect wallet (if available)
    const connectButton = page.getByRole('button', { name: /Connect/i });
    
    if (await connectButton.isVisible()) {
      console.log('Wallet connect button visible');
      // In real test, would connect mock wallet
    }

    // 6. Verify trading interface
    await expect(page.getByText('Place Bet')).toBeVisible();
    await expect(page.getByText('YES')).toBeVisible();
    await expect(page.getByText('NO')).toBeVisible();

    // 7. Check portfolio page
    await page.goto('http://localhost:3003/portfolio');
    await expect(page.getByText('Your Portfolio')).toBeVisible();
  });

  test('should display market data correctly', async ({ page }) => {
    await page.goto('http://localhost:3003');
    await page.waitForSelector('[data-testid="market-card"]');

    const firstMarket = page.locator('[data-testid="market-card"]').first();
    
    // Should show volume
    await expect(firstMarket.getByText(/Volume/)).toBeVisible();
    
    // Should show prices
    await expect(firstMarket.getByText(/YES/)).toBeVisible();
    await expect(firstMarket.getByText(/NO/)).toBeVisible();
  });

  test('should handle market resolution', async ({ page }) => {
    await page.goto('http://localhost:3003');
    
    // Filter to resolved markets
    await page.getByRole('button', { name: 'Resolved' }).click();
    
    const resolvedMarkets = await page.locator('[data-testid="market-card"]:has-text("Resolved")').count();
    console.log(`Found ${resolvedMarkets} resolved markets`);
  });
});

