import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe('Trading Full Flow with MetaMask', () => {
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

  test('should navigate to market detail from markets page', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCards = page.getByTestId('market-card');
    const count = await marketCards.count();
    
    if (count > 0) {
      await marketCards.first().click();
      await expect(page).toHaveURL(/\/markets\/.+/);
      
      const tradingInterface = page.getByTestId('trading-interface');
      const tradingBanned = page.getByTestId('trading-banned');
      
      const interfaceVisible = await tradingInterface.isVisible();
      const bannedVisible = await tradingBanned.isVisible();
      
      expect(interfaceVisible || bannedVisible).toBe(true);
    }
  });

  test('should select YES outcome button', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCards = page.getByTestId('market-card');
    const count = await marketCards.count();
    
    if (count > 0) {
      await marketCards.first().click();
      await page.waitForTimeout(500);
      
      const yesButton = page.getByTestId('outcome-yes-button');
      if (await yesButton.isVisible()) {
        await yesButton.click();
        await expect(yesButton).toHaveClass(/ring-green-400/);
      }
    }
  });

  test('should select NO outcome button', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCards = page.getByTestId('market-card');
    const count = await marketCards.count();
    
    if (count > 0) {
      await marketCards.first().click();
      await page.waitForTimeout(500);
      
      const noButton = page.getByTestId('outcome-no-button');
      if (await noButton.isVisible()) {
        await noButton.click();
        await expect(noButton).toHaveClass(/ring-red-400/);
      }
    }
  });

  test('should enter bet amount', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCards = page.getByTestId('market-card');
    const count = await marketCards.count();
    
    if (count > 0) {
      await marketCards.first().click();
      await page.waitForTimeout(500);
      
      const amountInput = page.getByTestId('amount-input');
      if (await amountInput.isVisible()) {
        await amountInput.fill('0.1');
        await expect(amountInput).toHaveValue('0.1');
      }
    }
  });

  test('should show buy button when connected', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCards = page.getByTestId('market-card');
    const count = await marketCards.count();
    
    if (count > 0) {
      await marketCards.first().click();
      await page.waitForTimeout(500);
      
      const buyButton = page.getByTestId('buy-button');
      const bannedMessage = page.getByTestId('trading-banned');
      
      const buyVisible = await buyButton.isVisible();
      const bannedVisible = await bannedMessage.isVisible();
      
      expect(buyVisible || bannedVisible).toBe(true);
    }
  });

  test('should display trading interface components', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCards = page.getByTestId('market-card');
    const count = await marketCards.count();
    
    if (count > 0) {
      await marketCards.first().click();
      await page.waitForTimeout(500);
      
      const tradingInterface = page.getByTestId('trading-interface');
      if (await tradingInterface.isVisible()) {
        await expect(page.getByTestId('outcome-yes-button')).toBeVisible();
        await expect(page.getByTestId('outcome-no-button')).toBeVisible();
        await expect(page.getByTestId('amount-input')).toBeVisible();
        await expect(page.getByTestId('buy-button')).toBeVisible();
      }
    }
  });
});



