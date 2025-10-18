import { test, expect, Page, BrowserContext } from '@playwright/test';
import { MetaMask, getMetaMask, launch } from 'dappwright';

const TEST_SEED_PHRASE = 'test test test test test test test test test test test junk';

test.describe('Market Resolution and Payout Flow', () => {
  let page: Page;
  let metamask: MetaMask;
  let context: BrowserContext;

  test.beforeAll(async () => {
    const result = await launch({
      headless: false,
      metamaskVersion: 'v11.16.17',
    });
    
    context = result.context;
    page = await context.newPage();
    metamask = await getMetaMask(page);
    
    await metamask.importSeed(TEST_SEED_PHRASE);
    await metamask.addNetwork({
      networkName: 'Jeju Local',
      rpc: 'http://localhost:8545',
      chainId: '42069',
      symbol: 'ETH'
    });
    
    await page.goto('http://localhost:3003');
    await page.getByRole('button', { name: /Connect/i }).click();
    await page.getByText('MetaMask').click();
    await metamask.approve();
    await expect(page.getByText(/0x/)).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('should display resolved markets with outcome', async () => {
    await page.goto('http://localhost:3003');
    
    // Click "Resolved" filter
    await page.getByRole('button', { name: 'Resolved' }).click();
    
    // Wait for resolved markets to load
    await page.waitForTimeout(2000);
    
    // Check if any resolved markets are displayed
    const resolvedBadges = page.getByText('Resolved');
    const count = await resolvedBadges.count();
    
    if (count > 0) {
      // Should show outcome
      await expect(page.getByText(/Outcome: (YES|NO)/)).toBeVisible();
    }
  });

  test('should claim winnings for resolved market', async () => {
    await page.goto('http://localhost:3003/portfolio');
    
    // Look for "Ready to claim" status
    const claimButton = page.getByRole('button', { name: 'Claim' }).first();
    
    if (await claimButton.isVisible()) {
      // Click claim
      await claimButton.click();
      
      // Confirm transaction in MetaMask
      await metamask.confirmTransaction();
      
      // Wait for success
      await expect(page.getByText('Claimed')).toBeVisible({ timeout: 30000 });
    }
  });

  test('should show final payout in transaction history', async () => {
    await page.goto('http://localhost:3003/portfolio');
    
    // Check positions table
    await expect(page.getByText('Positions')).toBeVisible();
    
    // Positions with claimed status should show P&L
    const pnlCells = page.locator('td').filter({ hasText: /[\+\-]\d/ });
    
    if (await pnlCells.count() > 0) {
      // At least one position should have P&L calculated
      await expect(pnlCells.first()).toBeVisible();
    }
  });

  test('should not allow trading on resolved markets', async () => {
    await page.goto('http://localhost:3003');
    
    // Filter to resolved markets
    await page.getByRole('button', { name: 'Resolved' }).click();
    await page.waitForTimeout(2000);
    
    const resolvedMarkets = page.locator('[data-testid="market-card"]').filter({ hasText: 'Resolved' });
    
    if (await resolvedMarkets.count() > 0) {
      // Click a resolved market
      await resolvedMarkets.first().click();
      
      // Should NOT show trading interface
      await expect(page.getByText('Place Bet')).not.toBeVisible();
      
      // Should show outcome instead
      await expect(page.getByText('Final Outcome')).toBeVisible();
    }
  });
});

