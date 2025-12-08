/**
 * Complete Liquidity Flow with Wallet - Every field interaction
 */

import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe('Complete Liquidity Flow with Wallet', () => {
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

  test('should fill complete liquidity form with wallet connected', async ({ page }) => {
    await page.goto('/liquidity');
    await page.waitForTimeout(500);
    
    // 1. Select Token A
    const tokenASelect = page.locator('select').first();
    const tokenAExists = await tokenASelect.isVisible();
    
    if (tokenAExists) {
      await tokenASelect.selectOption({ index: 0 });
      await page.waitForTimeout(200);
    }
    
    // 2. Enter Token A amount
    const tokenAAmount = page.locator('input[type="number"]').first();
    await tokenAAmount.fill('1.0');
    await page.waitForTimeout(300);
    expect(await tokenAAmount.inputValue()).toBe('1.0');
    
    // 3. Select Token B
    const tokenBSelect = page.locator('select').nth(1);
    const tokenBExists = await tokenBSelect.isVisible();
    
    if (tokenBExists) {
      await tokenBSelect.selectOption({ index: 1 });
      await page.waitForTimeout(200);
    }
    
    // 4. Enter Token B amount
    const tokenBAmount = page.locator('input[type="number"]').nth(1);
    await tokenBAmount.fill('3000');
    await page.waitForTimeout(300);
    
    // 5. Set price range (if visible)
    const minPriceInput = page.locator('input').filter({ hasText: /Min Price/i });
    const minPriceExists = await minPriceInput.count();
    
    if (minPriceExists > 0) {
      const minInput = page.locator('input[type="number"]').nth(2);
      const minExists = await minInput.isVisible();
      
      if (minExists) {
        await minInput.fill('2900');
        await page.waitForTimeout(200);
      }
      
      const maxInput = page.locator('input[type="number"]').nth(3);
      const maxExists = await maxInput.isVisible();
      
      if (maxExists) {
        await maxInput.fill('3100');
        await page.waitForTimeout(200);
      }
    }
    
    // 6. Select hook (if available)
    const hookSelect = page.locator('select').last();
    const hookExists = await hookSelect.isVisible();
    
    if (hookExists) {
      const optionCount = await hookSelect.locator('option').count();
      if (optionCount > 1) {
        await hookSelect.selectOption({ index: 1 });
        await page.waitForTimeout(200);
      }
    }
    
    // 7. Click Add Liquidity button
    const addButton = page.locator('button').filter({ hasText: /Add Liquidity/i }).first();
    const buttonVisible = await addButton.isVisible();
    
    if (buttonVisible) {
      const buttonText = await addButton.textContent();
      console.log('Add Liquidity button:', buttonText);
      
      // Click if not showing error state
      if (!buttonText?.includes('Not Deployed') && !buttonText?.includes('Switch')) {
        await addButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should test liquidity page from different entry points', async ({ page }) => {
    // From homepage
    await page.goto('/');
    await page.getByRole('link', { name: /Pools/i }).first().click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL('/pools');
    
    // Navigate to liquidity
    await page.goto('/liquidity');
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /Add Liquidity/i })).toBeVisible();
    
    // From Markets (via nav)
    await page.goto('/markets');
    await page.getByRole('link', { name: /Pools/i }).first().click();
    await page.waitForTimeout(500);
    
    // Back to liquidity
    await page.goto('/liquidity');
    await page.waitForTimeout(500);
    await expect(page).toHaveURL('/liquidity');
  });
});

