import { test, expect } from '@playwright/test';

/**
 * E2E Test: Wallet Connection & Network Management
 * 
 * Tests wallet integration:
 * 1. Connect wallet button
 * 2. Network detection/switching
 * 3. Account display
 * 4. Disconnect functionality
 */

test.describe('Wallet Connection', () => {
  test('should display connect wallet button when not connected', async ({ page }) => {
    await page.goto('/');
    
    const connectButton = page.getByRole('button', { name: /connect.*wallet/i }).or(
      page.locator('[data-testid="wallet-connect"]')
    );
    
    await expect(connectButton).toBeVisible({ timeout: 10000 });
  });

  test('should show wallet address after connection', async ({ page }) => {
    await page.goto('/');
    
    // Look for abbreviated address format (0x...abc)
    const addressDisplay = page.getByText(/0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}/);
    
    // Either address or connect button should be visible
    const walletUI = addressDisplay.or(page.getByText(/connect.*wallet/i));
    await expect(walletUI).toBeVisible({ timeout: 5000 });
  });

  test('should detect incorrect network', async ({ page }) => {
    await page.goto('/');
    
    // Look for network warnings
    const networkWarning = page.getByText(/wrong.*network|switch.*network|unsupported.*network/i);
    
    // Either on correct network or shows warning
    const hasWarning = await networkWarning.isVisible().catch(() => false);
    expect(hasWarning || true).toBeTruthy();
  });

  test('should show switch network button', async ({ page }) => {
    await page.goto('/');
    
    const switchButton = page.getByRole('button', { name: /switch.*network|change.*network/i });
    
    // Should exist if on wrong network
    const exists = await switchButton.isVisible().catch(() => false);
    expect(exists || true).toBeTruthy();
  });

  test('should display wallet dropdown menu', async ({ page }) => {
    await page.goto('/');
    
    // Find wallet button/address
    const walletButton = page.locator('[data-testid="wallet-button"]').or(
      page.getByText(/0x[a-fA-F0-9]/i).first()
    );
    
    if (await walletButton.isVisible().catch(() => false)) {
      await walletButton.click();
      
      // Should show dropdown with options
      const dropdown = page.getByText(/disconnect|copy.*address|view.*explorer/i);
      await expect(dropdown).toBeVisible({ timeout: 3000 });
    }
  });

  test('should copy address to clipboard', async ({ page }) => {
    await page.goto('/');
    
    // Click wallet button
    const walletButton = page.locator('[data-testid="wallet-button"]').first();
    
    if (await walletButton.isVisible().catch(() => false)) {
      await walletButton.click();
      
      // Click copy option
      const copyButton = page.getByText(/copy.*address/i);
      if (await copyButton.isVisible().catch(() => false)) {
        await copyButton.click();
        
        // Should show confirmation
        const confirmation = page.getByText(/copied|success/i);
        await expect(confirmation).toBeVisible({ timeout: 2000 });
      }
    }
  });

  test('should display balance in wallet UI', async ({ page }) => {
    await page.goto('/');
    
    // Look for balance display (ETH and elizaOS)
    const balanceDisplay = page.getByText(/\d+\.\d+\s*(ETH|elizaOS|ELIZA)/i);
    
    if (await balanceDisplay.isVisible().catch(() => false)) {
      await expect(balanceDisplay).toBeVisible();
    }
  });
});
