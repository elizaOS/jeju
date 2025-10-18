import { test, expect, Page, BrowserContext } from '@playwright/test';
import { MetaMask, getMetaMask, launch } from 'dappwright';

const TEST_SEED_PHRASE = 'test test test test test test test test test test test junk';

test.describe('Complete Trading Flow with Wallet', () => {
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
    
    // Connect wallet
    await page.goto('http://localhost:3003');
    await page.getByRole('button', { name: /Connect/i }).click();
    await page.getByText('MetaMask').click();
    await metamask.approve();
    await expect(page.getByText(/0x/)).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('should approve elizaOS token spending', async () => {
    // Navigate to a market
    await page.goto('http://localhost:3003');
    await page.waitForSelector('[data-testid="market-card"]', { timeout: 15000 });
    await page.locator('[data-testid="market-card"]').first().click();
    
    // Wait for trading interface
    await expect(page.getByText('Place Bet')).toBeVisible();
    
    // Enter amount
    await page.getByPlaceholder('100').fill('10');
    
    // Click buy button
    await page.getByRole('button', { name: /Buy YES/i }).click();
    
    // First transaction should be approval
    await metamask.confirmTransaction();
    
    // Wait for approval confirmation
    await expect(page.getByText('Approved')).toBeVisible({ timeout: 20000 });
  });

  test('should buy YES shares', async () => {
    await page.goto('http://localhost:3003');
    await page.waitForSelector('[data-testid="market-card"]');
    await page.locator('[data-testid="market-card"]').first().click();
    
    // Select YES
    await page.getByRole('button', { name: /YES/ }).click();
    
    // Enter amount
    await page.getByPlaceholder('100').fill('50');
    
    // Click buy
    await page.getByRole('button', { name: /Buy YES/i }).click();
    
    // Confirm transaction in MetaMask
    await metamask.confirmTransaction();
    
    // Wait for success
    await expect(page.getByText('Success')).toBeVisible({ timeout: 30000 });
  });

  test('should buy NO shares', async () => {
    await page.goto('http://localhost:3003');
    await page.waitForSelector('[data-testid="market-card"]');
    await page.locator('[data-testid="market-card"]').first().click();
    
    // Select NO
    await page.getByRole('button', { name: /NO/ }).click();
    
    // Enter amount
    await page.getByPlaceholder('100').fill('25');
    
    // Click buy
    await page.getByRole('button', { name: /Buy NO/i }).click();
    
    // Confirm transaction
    await metamask.confirmTransaction();
    
    // Wait for success
    await expect(page.getByText('Success')).toBeVisible({ timeout: 30000 });
  });

  test('should display user position in portfolio', async () => {
    // Navigate to portfolio
    await page.goto('http://localhost:3003/portfolio');
    
    // Should show positions
    await expect(page.getByText('Your Portfolio')).toBeVisible();
    await expect(page.getByText('Positions')).toBeVisible();
    
    // Should have at least one position
    const positionRows = page.locator('tbody tr');
    await expect(positionRows).not.toHaveCount(0);
  });

  test('should show price updates after trades', async () => {
    await page.goto('http://localhost:3003');
    await page.waitForSelector('[data-testid="market-card"]');
    const firstMarket = page.locator('[data-testid="market-card"]').first();
    
    // Get initial YES price
    const initialYesPrice = await firstMarket.getByText(/YES/).textContent();
    
    // Click market
    await firstMarket.click();
    
    // Make a trade
    await page.getByRole('button', { name: /YES/ }).click();
    await page.getByPlaceholder('100').fill('100');
    await page.getByRole('button', { name: /Buy YES/i }).click();
    await metamask.confirmTransaction();
    
    // Wait for trade to complete
    await page.waitForTimeout(5000);
    
    // Go back to homepage
    await page.goto('http://localhost:3003');
    await page.waitForSelector('[data-testid="market-card"]');
    
    // Check that price has changed
    const newMarket = page.locator('[data-testid="market-card"]').first();
    const newYesPrice = await newMarket.getByText(/YES/).textContent();
    
    expect(newYesPrice).not.toEqual(initialYesPrice);
  });
});

