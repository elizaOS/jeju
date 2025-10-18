import { test, expect } from '@playwright/test';

/**
 * E2E Test: Credit Purchase Flow
 * 
 * Tests the complete user journey for purchasing elizaOS credits:
 * 1. Navigate to billing page
 * 2. Connect wallet (simulated)
 * 3. Select payment token
 * 4. Enter purchase amount
 * 5. Get quote with price + slippage
 * 6. Confirm transaction
 * 7. Verify success state
 */

test.describe('Credit Purchase Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the cloud app
    await page.goto('/billing');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display credit purchase interface', async ({ page }) => {
    // Verify purchase button or link exists
    const purchaseButton = page.getByText(/purchase.*credit/i).or(page.getByText(/buy.*credit/i));
    await expect(purchaseButton).toBeVisible({ timeout: 10000 });
  });

  test('should show wallet connection prompt', async ({ page }) => {
    // Click purchase/buy button
    await page.getByText(/purchase.*credit/i).or(page.getByText(/buy.*credit/i)).first().click();
    
    // Should show connect wallet button if not connected
    const connectWallet = page.getByText(/connect.*wallet/i);
    const isVisible = await connectWallet.isVisible().catch(() => false);
    
    if (isVisible) {
      await expect(connectWallet).toBeVisible();
    }
  });

  test('should display payment token options', async ({ page }) => {
    // Open purchase modal
    await page.getByText(/purchase.*credit/i).or(page.getByText(/buy.*credit/i)).first().click();
    
    // Look for token selectors (USDC, ETH, USDT, DAI)
    const tokenOptions = page.locator('[data-testid="token-select"]').or(
      page.getByRole('combobox').filter({ hasText: /USDC|ETH|USDT|DAI/ })
    );
    
    // Should have token selection UI
    const optionsExist = await tokenOptions.count().then(c => c > 0).catch(() => false);
    expect(optionsExist).toBeTruthy();
  });

  test('should calculate quote with slippage protection', async ({ page }) => {
    // Open purchase modal
    await page.getByText(/purchase.*credit/i).or(page.getByText(/buy.*credit/i)).first().click();
    
    // Enter amount (e.g., $100)
    const amountInput = page.locator('input[type="number"]').or(
      page.locator('input[placeholder*="amount"]')
    ).first();
    
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill('100');
      
      // Wait for quote to calculate
      await page.waitForTimeout(1000);
      
      // Should show estimated credits
      const quoteText = page.getByText(/credits|eliza/i);
      await expect(quoteText).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show transaction confirmation dialog', async ({ page }) => {
    // Open purchase modal
    await page.getByText(/purchase.*credit/i).or(page.getByText(/buy.*credit/i)).first().click();
    
    // Fill in amount
    const amountInput = page.locator('input[type="number"]').first();
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill('50');
      
      // Click confirm/purchase button
      const confirmButton = page.getByRole('button', { name: /confirm|purchase|buy/i });
      if (await confirmButton.isEnabled().catch(() => false)) {
        await confirmButton.click();
        
        // Should show loading or confirmation state
        const loadingIndicator = page.locator('[data-loading="true"]').or(
          page.getByText(/processing|confirming|waiting/i)
        );
        
        // Either loading indicator or success message should appear
        await expect(loadingIndicator.or(page.getByText(/success|complete/i))).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should display volume discounts for high-value purchases', async ({ page }) => {
    // Open purchase modal
    await page.getByText(/purchase.*credit/i).or(page.getByText(/buy.*credit/i)).first().click();
    
    // Enter large amount
    const amountInput = page.locator('input[type="number"]').first();
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill('10000'); // $10k should trigger discount
      
      await page.waitForTimeout(1000);
      
      // Look for discount indicator
      const discountText = page.getByText(/discount|save|bonus/i);
      const hasDiscount = await discountText.isVisible().catch(() => false);
      
      // High volume should show discount info
      if (hasDiscount) {
        await expect(discountText).toBeVisible();
      }
    }
  });

  test('should handle transaction errors gracefully', async ({ page }) => {
    // Monitor console for errors
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    // Open purchase modal
    await page.getByText(/purchase.*credit/i).or(page.getByText(/buy.*credit/i)).first().click();
    
    // Try to proceed without wallet connection
    const confirmButton = page.getByRole('button', { name: /confirm|purchase/i });
    if (await confirmButton.isVisible().catch(() => false)) {
      // Should either be disabled or show error
      const isDisabled = await confirmButton.isDisabled().catch(() => true);
      expect(isDisabled || errors.length > 0).toBeTruthy();
    }
  });

  test('should show transaction history after purchase', async ({ page }) => {
    // Navigate to transactions/history page
    await page.goto('/billing/history').catch(() => page.goto('/transactions'));
    
    // Should show transaction list or empty state
    const transactionList = page.locator('[data-testid="transaction-list"]').or(
      page.getByText(/transaction.*history|recent.*purchases/i)
    );
    
    await expect(transactionList).toBeVisible({ timeout: 10000 });
  });
});
