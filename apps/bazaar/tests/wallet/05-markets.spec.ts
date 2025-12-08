import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

test.describe('Markets with Synpress', () => {
  test.beforeEach(async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)
    
    await page.goto('/')
    
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i })
    if (await connectButton.isVisible({ timeout: 5000 })) {
      await connectButton.click()
      await page.waitForTimeout(1000)
      await metamask.connectToDapp()
    }
  })

  test('should navigate to markets page', async ({ page }) => {
    await page.goto('/markets');
    
    await expect(page.getByRole('heading', { name: /Prediction Markets/i })).toBeVisible();
  });

  test('should display markets grid', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(1000);
    
    const grid = page.getByTestId('markets-grid');
    await expect(grid).toBeVisible();
  });

  test('should show market filters', async ({ page }) => {
    await page.goto('/markets');
    
    await expect(page.getByRole('button', { name: /All Markets/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Active/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Resolved/i })).toBeVisible();
  });

  test('should filter markets by status', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(1000);
    
    const activeButton = page.getByRole('button', { name: /^Active$/i });
    await activeButton.click();
    await expect(activeButton).toHaveClass(/bg-purple-600/);
    
    const resolvedButton = page.getByRole('button', { name: /^Resolved$/i });
    await resolvedButton.click();
    await expect(resolvedButton).toHaveClass(/bg-purple-600/);
  });

  test('should navigate to portfolio page', async ({ page }) => {
    await page.goto('/portfolio');
    
    await expect(page.getByRole('heading', { name: /Your Portfolio/i })).toBeVisible();
  });

  test('should show portfolio stats when connected', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForTimeout(1000);
    
    await expect(page.getByText(/Total Value/i)).toBeVisible();
    await expect(page.getByText(/Total P&L/i)).toBeVisible();
    await expect(page.getByText(/Active Positions/i)).toBeVisible();
  });

  test('should access markets from navigation', async ({ page }) => {
    await page.goto('/');
    
    await page.getByRole('link', { name: /^Markets$/i }).first().click();
    await expect(page).toHaveURL(/\/markets/);
  });

  test('should access portfolio from navigation', async ({ page }) => {
    await page.goto('/');
    
    await page.getByRole('link', { name: /^Portfolio$/i }).first().click();
    await expect(page).toHaveURL(/\/portfolio/);
  });
});



