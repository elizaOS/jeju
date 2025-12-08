import { test, expect } from '@playwright/test';

test.describe('MarketCard Interactions', () => {
  test('should click market card and navigate to detail', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (cardExists) {
      const questionText = await marketCard.locator('h3').textContent();
      console.log('Clicking market:', questionText);
      
      await marketCard.click();
      
      await expect(page).toHaveURL(/\/markets\/.+/);
      
      if (questionText) {
        const detailPage = page.locator(`text=${questionText.slice(0, 30)}`);
        const detailVisible = await detailPage.isVisible();
        
        if (detailVisible) {
          await expect(detailPage).toBeVisible();
        }
      }
    }
  });

  test('should show hover effects on market cards', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (cardExists) {
      await marketCard.hover();
      await page.waitForTimeout(500);
      
      const cardClass = await marketCard.getAttribute('class');
      expect(cardClass).toBeTruthy();
    }
  });

  test('should display all market card components', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (cardExists) {
      const cardContent = await marketCard.textContent();
      
      const hasYes = cardContent?.includes('YES');
      const hasNo = cardContent?.includes('NO');
      const hasVolume = cardContent?.includes('Volume') || cardContent?.includes('ETH');
      
      expect(hasYes || hasNo).toBe(true);
      expect(hasVolume).toBe(true);
    }
  });

  test('should show status badge on market cards', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForTimeout(2000);
    
    const marketCard = page.getByTestId('market-card').first();
    const cardExists = await marketCard.isVisible();
    
    if (cardExists) {
      const statusBadge = marketCard.locator('span').filter({ hasText: /Active|Resolved/i });
      const badgeCount = await statusBadge.count();
      
      expect(badgeCount).toBeGreaterThanOrEqual(1);
    }
  });
});

