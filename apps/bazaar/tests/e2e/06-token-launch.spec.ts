import { test, expect } from '@playwright/test'

test.describe('Token Launch Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/coins/launch')
  })

  test('renders launch page with all sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /launch token/i })).toBeVisible()
    
    // Token details section
    await expect(page.getByTestId('token-name-input')).toBeVisible()
    await expect(page.getByTestId('token-symbol-input')).toBeVisible()
    
    // Fee slider
    await expect(page.getByTestId('fee-slider')).toBeVisible()
    
    // Launch type buttons
    await expect(page.getByTestId('bonding-type-btn')).toBeVisible()
    await expect(page.getByTestId('ico-type-btn')).toBeVisible()
    
    // Launch button
    await expect(page.getByTestId('launch-btn')).toBeVisible()
  })

  test('can fill in token details', async ({ page }) => {
    await page.getByTestId('token-name-input').fill('Test Token')
    await page.getByTestId('token-symbol-input').fill('TEST')
    
    await expect(page.getByTestId('token-name-input')).toHaveValue('Test Token')
    await expect(page.getByTestId('token-symbol-input')).toHaveValue('TEST')
  })

  test('symbol input converts to uppercase', async ({ page }) => {
    await page.getByTestId('token-symbol-input').fill('test')
    await expect(page.getByTestId('token-symbol-input')).toHaveValue('TEST')
  })

  test('fee slider updates display', async ({ page }) => {
    const slider = page.getByTestId('fee-slider')
    
    // Set to 50%
    await slider.fill('50')
    
    await expect(page.getByText('Creator: 50%')).toBeVisible()
    await expect(page.getByText('Community: 50%')).toBeVisible()
  })

  test('can switch between launch types', async ({ page }) => {
    // Default is bonding
    const bondingBtn = page.getByTestId('bonding-type-btn')
    const icoBtn = page.getByTestId('ico-type-btn')
    
    await expect(bondingBtn).toHaveClass(/border-bazaar-primary/)
    
    // Switch to ICO
    await icoBtn.click()
    await expect(icoBtn).toHaveClass(/border-bazaar-primary/)
    
    // Should show ICO settings
    await expect(page.getByText('ICO Presale Settings')).toBeVisible()
    await expect(page.getByText('Soft Cap')).toBeVisible()
    await expect(page.getByText('Hard Cap')).toBeVisible()
    
    // Switch back to bonding
    await bondingBtn.click()
    await expect(page.getByText('Bonding Curve Settings')).toBeVisible()
  })

  test('shows summary with entered data', async ({ page }) => {
    await page.getByTestId('token-name-input').fill('My Token')
    await page.getByTestId('token-symbol-input').fill('MTK')
    
    await expect(page.getByText('My Token (MTK)')).toBeVisible()
    await expect(page.getByText('Platform Fee: 0%')).toBeVisible()
  })

  test('shows wallet connection message when not connected', async ({ page }) => {
    await expect(page.getByText('Please connect your wallet to launch a token')).toBeVisible()
  })

  test('has link to simple create page', async ({ page }) => {
    const link = page.getByRole('link', { name: /create basic erc20/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/coins/create')
  })

  test('launch button disabled without token name', async ({ page }) => {
    await page.getByTestId('token-symbol-input').fill('TEST')
    await expect(page.getByTestId('launch-btn')).toBeDisabled()
  })

  test('launch button disabled without symbol', async ({ page }) => {
    await page.getByTestId('token-name-input').fill('Test Token')
    await expect(page.getByTestId('launch-btn')).toBeDisabled()
  })
})
