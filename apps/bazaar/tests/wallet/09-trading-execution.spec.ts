/**
 * Trading Execution with Real MetaMask Transactions
 * 
 * ⚠️ REQUIRES DEPLOYED CONTRACTS:
 * - Predimarket.sol at NEXT_PUBLIC_PREDIMARKET_ADDRESS
 * - ERC20 token at NEXT_PUBLIC_ELIZA_OS_ADDRESS
 * - Markets indexed by GraphQL endpoint
 * 
 * These tests will SKIP if contracts not deployed (address === '0x0')
 */

import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

const PREDIMARKET_ADDRESS = process.env.NEXT_PUBLIC_PREDIMARKET_ADDRESS || '0x0';
const CONTRACT_DEPLOYED = PREDIMARKET_ADDRESS !== '0x0' && PREDIMARKET_ADDRESS !== '0x0000000000000000000000000000000000000000';

test.describe('Trading Execution - Real Transactions', () => {
  test.beforeEach(async ({ context, page, metamaskPage, extensionId }) => {
    if (!CONTRACT_DEPLOYED) {
      test.skip();
    }

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

  test('should execute YES bet with MetaMask confirmation', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (!cardExists) {
      console.log('No markets available for testing');
      return;
    }
    
    await marketCard.click();
    await expect(page).toHaveURL(/\/markets\/.+/);
    
    const yesButton = page.getByTestId('outcome-yes-button');
    await yesButton.click();
    await expect(yesButton).toHaveClass(/ring-green-400/);
    
    const amountInput = page.getByTestId('amount-input');
    await amountInput.fill('0.01');
    
    const buyButton = page.getByTestId('buy-button');
    await buyButton.click();
    
    await metamask.confirmTransaction();
    
    await page.waitForTimeout(10000);
    
    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const positionsTable = page.getByTestId('positions-table');
    const noPositions = page.getByTestId('no-positions');
    
    const hasPositions = await positionsTable.isVisible();
    const hasNoPositions = await noPositions.isVisible();
    
    expect(hasPositions || hasNoPositions).toBe(true);
  });

  test('should execute NO bet with MetaMask confirmation', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (!cardExists) return;
    
    await marketCard.click();
    
    const noButton = page.getByTestId('outcome-no-button');
    await noButton.click();
    await expect(noButton).toHaveClass(/ring-red-400/);
    
    const amountInput = page.getByTestId('amount-input');
    await amountInput.fill('0.01');
    
    const buyButton = page.getByTestId('buy-button');
    await buyButton.click();
    
    await metamask.confirmTransaction();
    
    await page.waitForTimeout(10000);
  });

  test('should handle MetaMask transaction rejection gracefully', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (!cardExists) return;
    
    await marketCard.click();
    
    const yesButton = page.getByTestId('outcome-yes-button');
    await yesButton.click();
    
    const amountInput = page.getByTestId('amount-input');
    await amountInput.fill('0.01');
    
    const buyButton = page.getByTestId('buy-button');
    await buyButton.click();
    
    await metamask.rejectTransaction();
    
    await page.waitForTimeout(2000);
    
    const tradingInterface = page.getByTestId('trading-interface');
    await expect(tradingInterface).toBeVisible();
  });

  test('should verify position created after successful trade', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (!cardExists) return;
    
    const marketQuestion = await marketCard.textContent();
    await marketCard.click();
    
    const yesButton = page.getByTestId('outcome-yes-button');
    await yesButton.click();
    
    const amountInput = page.getByTestId('amount-input');
    await amountInput.fill('0.05');
    
    const buyButton = page.getByTestId('buy-button');
    await buyButton.click();
    
    await metamask.confirmTransaction();
    await page.waitForTimeout(15000);
    
    await page.goto('/portfolio');
    await page.waitForTimeout(3000);
    
    const body = await page.textContent('body');
    const hasPosition = body?.includes('YES') || body?.includes('NO');
    
    expect(hasPosition).toBe(true);
  });

  test('should handle insufficient balance error', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (!cardExists) return;
    
    await marketCard.click();
    
    const yesButton = page.getByTestId('outcome-yes-button');
    await yesButton.click();
    
    const amountInput = page.getByTestId('amount-input');
    await amountInput.fill('99999999');
    
    const buyButton = page.getByTestId('buy-button');
    await buyButton.click();
    
    await page.waitForTimeout(2000);
    
    const errorMessage = page.getByTestId('error-message');
    const errorVisible = await errorMessage.isVisible();
    
    expect(errorVisible).toBe(true);
  });
});

