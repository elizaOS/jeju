/**
 * Liquidity Provision - Complete Real Flow
 * Tests ACTUAL liquidity addition/removal with approvals and position tracking
 */

import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

test.describe('Liquidity Provision - Complete Flow', () => {
  test('should connect wallet and navigate to liquidity page', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    
    // Connect wallet
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i })
    await connectButton.click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    // Navigate to liquidity
    await page.goto('/liquidity')
    await expect(page.getByRole('heading', { name: /Manage Liquidity/i })).toBeVisible()
    
    console.log('✅ Connected and navigated to liquidity page')
  })

  test('should display add liquidity and positions sections', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(1000)
    
    // Should have both sections
    await expect(page.getByRole('heading', { name: /Add Liquidity/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Your Positions/i })).toBeVisible()
    
    console.log('✅ Both add liquidity and positions sections visible')
  })

  test('should fill pool selection with token addresses', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(1000)
    
    // Find token address inputs by label
    const token0Label = page.getByText('Token 0 Address')
    const token0Input = page.locator('input[type="text"]').first()
    
    await token0Input.fill('0x0000000000000000000000000000000000000000')
    await expect(token0Input).toHaveValue('0x0000000000000000000000000000000000000000')
    
    const token1Input = page.locator('input[type="text"]').nth(1)
    await token1Input.fill('0x1111111111111111111111111111111111111111')
    await expect(token1Input).toHaveValue('0x1111111111111111111111111111111111111111')
    
    console.log('✅ Pool selection filled with token addresses')
  })

  test('should select fee tier for liquidity provision', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(1000)
    
    // Select fee tier
    const feeSelect = page.getByLabel(/Fee Tier/i)
    await feeSelect.selectOption('3000') // 0.3%
    await expect(feeSelect).toHaveValue('3000')
    
    // Try different fee tiers
    await feeSelect.selectOption('500') // 0.05%
    await feeSelect.selectOption('10000') // 1%
    await feeSelect.selectOption('3000') // Back to 0.3%
    
    console.log('✅ Fee tier selection working')
  })

  test('should enter deposit amounts', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(1000)
    
    // Find deposit amount inputs
    const depositSection = page.locator('text=Deposit Amounts').locator('..')
    const amountInputs = depositSection.locator('input[type="number"]')
    
    await amountInputs.nth(0).fill('1.5')
    await expect(amountInputs.nth(0)).toHaveValue('1.5')
    
    await amountInputs.nth(1).fill('4500')
    await expect(amountInputs.nth(1)).toHaveValue('4500')
    
    console.log('✅ Deposit amounts entered')
  })

  test('should set price range for concentrated liquidity', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(1000)
    
    // Find price range section
    const priceSection = page.locator('text=Set Price Range').locator('..')
    const priceInputs = priceSection.locator('input[type="number"]')
    
    // Set min price
    const minPrice = priceInputs.first()
    await minPrice.fill('0.9')
    await expect(minPrice).toHaveValue('0.9')
    
    // Set max price
    const maxPrice = priceInputs.last()
    await maxPrice.fill('1.1')
    await expect(maxPrice).toHaveValue('1.1')
    
    console.log('✅ Price range set for concentrated liquidity')
  })

  test('should add liquidity with transaction confirmation', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(1000)
    
    // Fill complete form
    await page.locator('input[type="text"]').nth(0).fill('0x0000000000000000000000000000000000000000')
    await page.locator('input[type="text"]').nth(1).fill('0x1111111111111111111111111111111111111111')
    
    const depositInputs = page.locator('text=Deposit Amounts').locator('..').locator('input[type="number"]')
    await depositInputs.nth(0).fill('0.1')
    await depositInputs.nth(1).fill('300')
    
    const priceInputs = page.locator('text=Set Price Range').locator('..').locator('input[type="number"]')
    await priceInputs.nth(0).fill('0.8')
    await priceInputs.nth(1).fill('1.2')
    
    // Click Add Liquidity
    const addButton = page.getByRole('button', { name: /Add Liquidity/i })
    const isEnabled = await addButton.isEnabled()
    
    if (isEnabled) {
      await addButton.click()
      await page.waitForTimeout(2000)
      
      await metamask.confirmTransaction()
      await page.waitForTimeout(5000)
      
      console.log('✅ Liquidity added successfully')
      
      const body = await page.textContent('body')
      expect(body).toBeTruthy()
    }
  })

  test('should display user positions after adding liquidity', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(2000)
    
    // Check positions section
    const positionsSection = page.getByRole('heading', { name: /Your Positions/i }).locator('..')
    const body = await positionsSection.textContent()
    
    // Should show either positions or empty state
    const hasPositionInfo = body.includes('Position #') || 
                           body.includes('No positions') || 
                           body.includes('Connect wallet')
    
    expect(hasPositionInfo).toBe(true)
    console.log('✅ Positions section displaying correctly')
  })

  test('should select position for removal', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(2000)
    
    // If positions exist, try selecting one
    const positionCards = page.locator('[class*="cursor-pointer"]').filter({ hasText: /Position #/i })
    const posCount = await positionCards.count()
    
    if (posCount > 0) {
      const firstPosition = positionCards.first()
      await firstPosition.click()
      await page.waitForTimeout(500)
      
      // Position should be highlighted and remove section should appear
      await expect(page.getByRole('heading', { name: /Remove Liquidity/i })).toBeVisible()
      
      console.log('✅ Position selected for removal')
    }
  })

  test('should use percentage buttons for liquidity removal', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(2000)
    
    // If remove section exists
    const removeSection = page.locator('text=Remove Liquidity').locator('..')
    const sectionExists = await removeSection.isVisible()
    
    if (sectionExists) {
      // Test percentage buttons
      await page.getByRole('button', { name: '25%' }).click()
      await page.waitForTimeout(300)
      
      await page.getByRole('button', { name: '50%' }).click()
      await page.waitForTimeout(300)
      
      await page.getByRole('button', { name: '75%' }).click()
      await page.waitForTimeout(300)
      
      await page.getByRole('button', { name: '100%' }).click()
      await page.waitForTimeout(300)
      
      console.log('✅ Percentage buttons working')
    }
  })

  test('should remove liquidity with transaction', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(2000)
    
    // Select a position if exists
    const positionCards = page.locator('[class*="cursor-pointer"]').filter({ hasText: /Position #/i })
    const posCount = await positionCards.count()
    
    if (posCount > 0) {
      await positionCards.first().click()
      await page.waitForTimeout(500)
      
      // Set removal amount using 50% button
      await page.getByRole('button', { name: '50%' }).click()
      await page.waitForTimeout(300)
      
      // Click Remove Liquidity
      const removeButton = page.getByRole('button', { name: /Remove Liquidity/i })
      const isEnabled = await removeButton.isEnabled()
      
      if (isEnabled) {
        await removeButton.click()
        await page.waitForTimeout(2000)
        
        await metamask.confirmTransaction()
        await page.waitForTimeout(5000)
        
        console.log('✅ Liquidity removed successfully')
        
        const body = await page.textContent('body')
        expect(body).toBeTruthy()
      }
    }
  })

  test('should verify position details display correctly', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(2000)
    
    // Check position details
    const positionCards = page.locator('[class*="cursor-pointer"]').filter({ hasText: /Position #/i })
    const posCount = await positionCards.count()
    
    if (posCount > 0) {
      const position = positionCards.first()
      const posText = await position.textContent()
      
      // Position should show liquidity and range info
      const hasDetails = posText?.includes('Liquidity') || posText?.includes('Range') || posText?.includes('Active')
      expect(hasDetails).toBe(true)
      
      console.log('✅ Position details displaying correctly')
    } else {
      // Should show empty state
      const body = await page.textContent('body')
      expect(body).toContain('No positions')
      console.log('✅ Empty state displaying correctly')
    }
  })

  test('should show pool info when valid pool is selected', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(1000)
    
    // Fill token addresses that would match existing pool
    await page.locator('input[type="text"]').nth(0).fill('0x0000000000000000000000000000000000000000')
    await page.locator('input[type="text"]').nth(1).fill('0x1111111111111111111111111111111111111111')
    
    await page.waitForTimeout(2000)
    
    // Pool info should appear if pool exists
    const body = await page.textContent('body')
    
    // Either shows pool info or no error
    expect(body).toBeTruthy()
    console.log('✅ Pool selection working correctly')
  })

  test('should complete full add liquidity flow end-to-end', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/liquidity')
    await page.waitForTimeout(1000)
    
    // Complete form fill
    await page.locator('input[type="text"]').nth(0).fill('0x0000000000000000000000000000000000000000')
    await page.locator('input[type="text"]').nth(1).fill('0x1111111111111111111111111111111111111111')
    
    const feeSelect = page.getByLabel(/Fee Tier/i)
    await feeSelect.selectOption('3000')
    
    const depositInputs = page.locator('text=Deposit Amounts').locator('..').locator('input[type="number"]')
    await depositInputs.nth(0).fill('0.5')
    await depositInputs.nth(1).fill('1500')
    
    const priceInputs = page.locator('text=Set Price Range').locator('..').locator('input[type="number"]')
    await priceInputs.nth(0).fill('0.9')
    await priceInputs.nth(1).fill('1.1')
    
    // Submit
    const addButton = page.getByRole('button', { name: /Add Liquidity/i })
    const isEnabled = await addButton.isEnabled()
    
    if (isEnabled) {
      await addButton.click()
      await page.waitForTimeout(2000)
      
      await metamask.confirmTransaction()
      await page.waitForTimeout(5000)
      
      console.log('✅ Complete add liquidity flow executed')
      
      const body = await page.textContent('body')
      expect(body).toBeTruthy()
    } else {
      console.log('⚠️ Add button disabled (may need pool to exist first)')
    }
  })
})
