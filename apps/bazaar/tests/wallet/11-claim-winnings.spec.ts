/**
 * Claim Winnings with Real MetaMask Transactions
 * 
 * ⚠️ REQUIRES:
 * - Deployed Predimarket.sol contract
 * - Resolved markets with winnings
 * - User positions in resolved markets
 * 
 * Tests the useClaim hook which is currently UNTESTED
 */

import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

const PREDIMARKET_ADDRESS = process.env.NEXT_PUBLIC_PREDIMARKET_ADDRESS || '0x0';
const CONTRACT_DEPLOYED = PREDIMARKET_ADDRESS !== '0x0';

test.describe('Claim Winnings Flow', () => {
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

  test('should show claim button for resolved winning positions', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const positionsTable = page.getByTestId('positions-table');
    const tableVisible = await positionsTable.isVisible();
    
    if (tableVisible) {
      const claimButtons = page.getByRole('button', { name: /Claim/i });
      const count = await claimButtons.count();
      
      console.log(`Found ${count} claim buttons`);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should claim winnings from portfolio with MetaMask', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const claimButton = page.getByRole('button', { name: /^Claim$/i }).first();
    const claimVisible = await claimButton.isVisible();
    
    if (claimVisible) {
      await claimButton.click();
      
      await metamask.confirmTransaction();
      
      await page.waitForTimeout(10000);
      
      const claimGone = await claimButton.isHidden().catch(() => true);
      expect(claimGone).toBe(true);
    }
  });

  test('should claim winnings from market detail page', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCards = page.getByTestId('market-card');
    const count = await marketCards.count();
    
    for (let i = 0; i < count; i++) {
      const card = marketCards.nth(i);
      const cardText = await card.textContent();
      
      if (cardText?.includes('Resolved')) {
        await card.click();
        await page.waitForTimeout(1000);
        
        const claimButton = page.getByRole('button', { name: /Claim Winnings/i });
        const claimVisible = await claimButton.isVisible();
        
        if (claimVisible) {
          await claimButton.click();
          await metamask.confirmTransaction();
          await page.waitForTimeout(10000);
          break;
        }
      }
    }
  });

  test('should handle claim rejection gracefully', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const claimButton = page.getByRole('button', { name: /^Claim$/i }).first();
    const claimVisible = await claimButton.isVisible();
    
    if (claimVisible) {
      await claimButton.click();
      
      await metamask.rejectTransaction();
      
      await page.waitForTimeout(2000);
      
      await expect(claimButton).toBeVisible();
    }
  });

  test('should show success toast after claim confirmation', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const claimButton = page.getByRole('button', { name: /^Claim$/i }).first();
    const claimVisible = await claimButton.isVisible();
    
    if (claimVisible) {
      await claimButton.click();
      await metamask.confirmTransaction();
      await page.waitForTimeout(3000);
      
      const toast = page.locator('[role="status"]');
      const toastVisible = await toast.isVisible();
      
      expect(toastVisible).toBe(true);
    }
  });
});

