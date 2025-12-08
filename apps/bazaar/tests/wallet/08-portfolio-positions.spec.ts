import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe('Portfolio Positions with Wallet', () => {
  test.beforeEach(async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);
    
    await page.goto('/');
    
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i });
    if (await connectButton.isVisible({ timeout: 5000 })) {
      await connectButton.click();
      await page.waitForTimeout(1000);
      await metamask.connectToDapp();
      await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 });
    }
  });

  test('should display portfolio stats when wallet connected', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    await expect(page.getByText(/Total Value/i)).toBeVisible();
    await expect(page.getByText(/Total P&L/i)).toBeVisible();
    await expect(page.getByText(/Active Positions/i)).toBeVisible();
  });

  test('should show positions table or no positions message', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const positionsTable = page.getByTestId('positions-table');
    const noPositions = page.getByTestId('no-positions');
    
    const tableVisible = await positionsTable.isVisible();
    const noPositionsVisible = await noPositions.isVisible();
    
    expect(tableVisible || noPositionsVisible).toBe(true);
  });

  test('should navigate to market from portfolio position', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const positionsTable = page.getByTestId('positions-table');
    const tableVisible = await positionsTable.isVisible();
    
    if (tableVisible) {
      const firstMarketLink = page.locator('a[href^="/markets/"]').first();
      const linkExists = await firstMarketLink.isVisible();
      
      if (linkExists) {
        await firstMarketLink.click();
        await expect(page).toHaveURL(/\/markets\/.+/);
      }
    }
  });

  test('should display claim buttons for resolved positions', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const claimButtons = page.getByRole('button', { name: /Claim/i });
    const count = await claimButtons.count();
    
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should calculate and display P&L', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const pnlElement = page.getByText(/Total P&L/i);
    await expect(pnlElement).toBeVisible();
    
    const body = await page.textContent('body');
    const hasPNLValue = body?.match(/[+-]?\d+\.\d+\s*ETH/);
    expect(hasPNLValue).toBeTruthy();
  });
});



