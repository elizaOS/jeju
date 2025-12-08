import { test, expect } from '@playwright/test';

test.describe('Coins Listing Page', () => {
  test('should display coins page', async ({ page }) => {
    await page.goto('/coins')

    await expect(page.getByRole('heading', { name: /Coins/i })).toBeVisible()
    await expect(page.getByText(/Browse and trade coins/i)).toBeVisible()
  })

  test('should show create coin button', async ({ page }) => {
    await page.goto('/coins')

    const createButton = page.getByRole('link', { name: /Create Coin/i })
    await expect(createButton).toBeVisible()
    await expect(createButton).toHaveAttribute('href', '/coins/create')
  })

  test('should have filter buttons', async ({ page }) => {
    await page.goto('/coins')

    await expect(page.getByRole('button', { name: /All Coins/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Verified/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /New/i })).toBeVisible()
  })

  test('should switch between filters', async ({ page }) => {
    await page.goto('/coins')

    const allButton = page.getByRole('button', { name: /All Coins/i })
    const verifiedButton = page.getByRole('button', { name: /Verified/i })

    // Click verified filter
    await verifiedButton.click()
    await expect(verifiedButton).toHaveClass(/bg-purple-600/)

    // Click back to all
    await allButton.click()
    await expect(allButton).toHaveClass(/bg-purple-600/)
  })
})



