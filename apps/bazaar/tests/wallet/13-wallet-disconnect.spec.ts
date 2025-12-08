/**
 * Wallet Disconnect Flow - Complete connection lifecycle
 */

import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe('Wallet Connection Lifecycle', () => {
  test('should connect and then disconnect wallet', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);
    
    await page.goto('/');
    
    // Connect wallet
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i });
    await expect(connectButton).toBeVisible();
    await connectButton.click();
    await page.waitForTimeout(1000);
    
    await metamask.connectToDapp();
    await page.waitForTimeout(2000);
    
    // Verify connected
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 });
    
    // Click disconnect
    const disconnectButton = page.getByRole('button', { name: /Disconnect/i });
    await expect(disconnectButton).toBeVisible();
    await disconnectButton.click();
    await page.waitForTimeout(1000);
    
    // Verify disconnected
    await expect(page.getByText(/0xf39F/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible();
  });

  test('should maintain disconnected state across page navigation', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);
    
    await page.goto('/');
    
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i });
    await connectButton.click();
    await page.waitForTimeout(1000);
    await metamask.connectToDapp();
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 });
    
    // Disconnect
    const disconnectButton = page.getByRole('button', { name: /Disconnect/i });
    await disconnectButton.click();
    await page.waitForTimeout(1000);
    
    // Navigate to different pages - should stay disconnected
    const pages = ['/tokens', '/markets', '/portfolio', '/swap'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForTimeout(500);
      
      // Should NOT show wallet address
      const walletText = await page.getByText(/0xf39F/i).isVisible();
      expect(walletText).toBe(false);
      
      // Should show Connect Wallet button
      await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible();
    }
  });
});

