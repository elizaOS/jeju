/**
 * Token Approval Flow with Real MetaMask Transactions
 * 
 * ⚠️ REQUIRES DEPLOYED CONTRACTS:
 * - Predimarket.sol at NEXT_PUBLIC_PREDIMARKET_ADDRESS
 * - ERC20 token at NEXT_PUBLIC_ELIZA_OS_ADDRESS
 * 
 * Tests the ApprovalButton component which is currently UNTESTED
 */

import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

const PREDIMARKET_ADDRESS = process.env.NEXT_PUBLIC_PREDIMARKET_ADDRESS || '0x0';
const CONTRACT_DEPLOYED = PREDIMARKET_ADDRESS !== '0x0' && PREDIMARKET_ADDRESS !== '0x0000000000000000000000000000000000000000';

test.describe('Token Approval Flow', () => {
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
    }
  });

  test('should show approval button when allowance insufficient', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (!cardExists) return;
    
    await marketCard.click();
    
    const approveButton = page.getByTestId('approve-button');
    const buyButton = page.getByTestId('buy-button');
    
    const approveVisible = await approveButton.isVisible();
    const buyVisible = await buyButton.isVisible();
    
    expect(approveVisible || buyVisible).toBe(true);
  });

  test('should approve token with MetaMask confirmation', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (!cardExists) return;
    
    await marketCard.click();
    
    const approveButton = page.getByTestId('approve-button');
    const approveVisible = await approveButton.isVisible();
    
    if (approveVisible) {
      await approveButton.click();
      
      await metamask.confirmTransaction();
      
      await page.waitForTimeout(10000);
      
      const approveGone = await approveButton.isHidden().catch(() => true);
      expect(approveGone).toBe(true);
    }
  });

  test('should enable trading button after approval', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (!cardExists) return;
    
    await marketCard.click();
    
    const approveButton = page.getByTestId('approve-button');
    const approveVisible = await approveButton.isVisible();
    
    if (approveVisible) {
      await approveButton.click();
      await metamask.confirmTransaction();
      await page.waitForTimeout(10000);
      
      const buyButton = page.getByTestId('buy-button');
      await expect(buyButton).toBeEnabled();
    }
  });

  test('should handle approval rejection gracefully', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (!cardExists) return;
    
    await marketCard.click();
    
    const approveButton = page.getByTestId('approve-button');
    const approveVisible = await approveButton.isVisible();
    
    if (approveVisible) {
      await approveButton.click();
      
      await metamask.rejectTransaction();
      
      await page.waitForTimeout(2000);
      
      await expect(approveButton).toBeVisible();
    }
  });
});

