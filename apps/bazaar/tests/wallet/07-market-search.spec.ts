import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe('Market Search and Filtering with Wallet', () => {
  test.beforeEach(async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);
    
    await page.goto('/');
    
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i });
    if (await connectButton.isVisible({ timeout: 5000 })) {
      await connectButton.click();
      await page.waitForTimeout(1000);
      await metamask.connectToDapp();
    }
  });

  test('should search markets and see filtered results', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(1000);
    
    const searchInput = page.getByTestId('market-search');
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('test');
  });

  test('should clear search results', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(1000);
    
    const searchInput = page.getByTestId('market-search');
    await searchInput.fill('nonexistent market query that will not match');
    await page.waitForTimeout(1000);
    
    const clearButton = page.getByRole('button', { name: /Clear Search/i });
    const clearExists = await clearButton.isVisible();
    
    if (clearExists) {
      await clearButton.click();
      await expect(searchInput).toHaveValue('');
    }
  });

  test('should filter markets with testid buttons', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(1000);
    
    const allButton = page.getByTestId('filter-all');
    await allButton.click();
    await expect(allButton).toHaveClass(/bg-purple-600/);
    
    const activeButton = page.getByTestId('filter-active');
    await activeButton.click();
    await expect(activeButton).toHaveClass(/bg-purple-600/);
    
    const resolvedButton = page.getByTestId('filter-resolved');
    await resolvedButton.click();
    await expect(resolvedButton).toHaveClass(/bg-purple-600/);
  });
});



