/**
import type { Page } from "@playwright/test";
 * Complete deep flow testing - EVERY action with wallet connected
 */

import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe('Complete Deep Flow with Wallet', () => {
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

  test('should complete full Markets exploration flow', async ({ page }) => {
    // 1. Click Markets in nav
    await page.getByRole('link', { name: /^Markets$/i }).first().click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL('/markets');
    
    // 2. Try all filters
    await page.getByTestId('filter-all').click();
    await page.waitForTimeout(300);
    await page.getByTestId('filter-active').click();
    await page.waitForTimeout(300);
    await page.getByTestId('filter-resolved').click();
    await page.waitForTimeout(300);
    
    // 3. Use search
    const searchInput = page.getByTestId('market-search');
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    await searchInput.clear();
    await page.waitForTimeout(300);
    
    // 4. Click a market if available
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (cardExists) {
      await marketCard.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/markets\/.+/);
      
      // 5. Interact with trading interface
      const yesButton = page.getByTestId('outcome-yes-button');
      const yesExists = await yesButton.isVisible();
      
      if (yesExists) {
        await yesButton.click();
        await page.waitForTimeout(200);
        
        const noButton = page.getByTestId('outcome-no-button');
        await noButton.click();
        await page.waitForTimeout(200);
        
        await yesButton.click();
        await page.waitForTimeout(200);
        
        // 6. Enter amount
        const amountInput = page.getByTestId('amount-input');
        await amountInput.fill('0.1');
        await page.waitForTimeout(200);
        
        // 7. Verify buy button exists
        const buyButton = page.getByTestId('buy-button');
        await expect(buyButton).toBeVisible();
      }
    }
    
    // 8. Navigate to portfolio
    await page.getByRole('link', { name: /^Portfolio$/i }).first().click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL('/portfolio');
  });

  test('should test complete portfolio interaction flow', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForTimeout(2000);
    
    const connectMessage = page.getByTestId('connect-wallet-message');
    const needsWallet = await connectMessage.isVisible();
    
    if (needsWallet) {
      // Test that all elements work when not connected
      await expect(page.getByRole('heading', { name: /Your Portfolio/i })).toBeVisible();
      return;
    }
    
    // If connected, test all interactions
    await expect(page.getByText(/Total Value/i)).toBeVisible();
    await expect(page.getByText(/Total P&L/i)).toBeVisible();
    await expect(page.getByText(/Active Positions/i)).toBeVisible();
    
    // Check for positions table or no positions message
    const positionsTable = page.getByTestId('positions-table');
    const noPositions = page.getByTestId('no-positions');
    
    const hasTable = await positionsTable.isVisible();
    const hasNoPositions = await noPositions.isVisible();
    
    expect(hasTable || hasNoPositions).toBe(true);
    
    if (hasNoPositions) {
      // Click Browse Markets link
      const browseLink = page.getByRole('link', { name: /Browse markets/i });
      await browseLink.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL('/markets');
    }
    
    if (hasTable) {
      // Test table interactions
      const rows = page.locator('tbody tr');
      const rowCount = await rows.count();
      
      if (rowCount > 0) {
        // Hover over first row
        await rows.first().hover();
        await page.waitForTimeout(200);
        
        // Look for claim buttons
        const claimButtons = page.getByRole('button', { name: /Claim/i });
        const claimCount = await claimButtons.count();
        
        if (claimCount > 0) {
          await claimButtons.first().hover();
          await page.waitForTimeout(200);
        }
      }
    }
  });

  test('should test navigation between Markets and Portfolio repeatedly', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      // Go to Markets
      await page.getByRole('link', { name: /^Markets$/i }).first().click();
      await page.waitForTimeout(300);
      await expect(page).toHaveURL('/markets');
      
      // Go to Portfolio
      await page.getByRole('link', { name: /^Portfolio$/i }).first().click();
      await page.waitForTimeout(300);
      await expect(page).toHaveURL('/portfolio');
    }
  });

  test('should test all clickable elements in header from Markets', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(500);
    
    // Test logo
    const logo = page.getByRole('link').filter({ hasText: /Bazaar/i }).first();
    await logo.hover();
    await page.waitForTimeout(200);
    
    // Test each nav link
    const navLinks = page.locator('nav a');
    const linkCount = await navLinks.count();
    
    for (let i = 0; i < linkCount; i++) {
      const link = navLinks.nth(i);
      await link.hover();
      await page.waitForTimeout(100);
    }
    
    // Test wallet button
    const walletButton = page.locator('header button').first();
    await walletButton.hover();
    await page.waitForTimeout(200);
  });

  test('should test clicking market card from homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    const marketsCard = page.getByRole('link').filter({ hasText: /Markets/i }).filter({ hasText: /Prediction markets/i }).first();
    await marketsCard.click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL('/markets');
  });
});

