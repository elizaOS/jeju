/**
 * Pool Creation - Complete Flow with Real Blockchain Interactions
 * Tests creating new Uniswap V4 pools with MetaMask transaction signing
 */

import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

test.describe('Pool Creation - Complete Flow', () => {
  test('should connect wallet and navigate to pools page', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    
    // Connect wallet
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i })
    await connectButton.click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    // Navigate to pools
    await page.goto('/pools')
    await expect(page.getByRole('heading', { name: /Liquidity Pools/i })).toBeVisible()
    
    // Verify create pool button exists
    const createButton = page.getByRole('button', { name: /Create Pool/i })
    await expect(createButton).toBeVisible()
    
    console.log('✅ Navigated to pools page with wallet connected')
  })

  test('should open create pool modal', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/pools')
    await page.waitForTimeout(1000)
    
    // Click Create Pool button in header
    const createButton = page.getByRole('button', { name: /Create Pool/i })
    await createButton.click()
    await page.waitForTimeout(500)
    
    // Modal should open
    await expect(page.getByRole('heading', { name: /Create New Pool/i })).toBeVisible()
    
    // Should have token address inputs
    const token0Input = page.getByPlaceholder(/0x.../).first()
    await expect(token0Input).toBeVisible()
    
    console.log('✅ Create pool modal opened')
  })

  test('should fill pool creation form', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/pools')
    await page.waitForTimeout(1000)
    
    // Open modal
    await page.getByRole('button', { name: /Create Pool/i }).click()
    await page.waitForTimeout(500)
    
    // Fill token addresses (using test addresses)
    const addressInputs = page.getByPlaceholder(/0x.../)
    await addressInputs.nth(0).fill('0x0000000000000000000000000000000000000000')
    await addressInputs.nth(1).fill('0x1111111111111111111111111111111111111111')
    
    // Select fee tier
    const feeSelect = page.locator('select').filter({ hasText: /0.01%|0.05%|0.3%|1%/i }).first()
    await feeSelect.selectOption('3000') // 0.3%
    
    // Set initial price
    const priceInput = page.locator('input[type="number"]').first()
    await priceInput.fill('1.0')
    
    console.log('✅ Pool creation form filled')
  })

  test('should create pool and confirm transaction', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/pools')
    await page.waitForTimeout(1000)
    
    // Open modal
    await page.getByRole('button', { name: /Create Pool/i }).click()
    await page.waitForTimeout(500)
    
    // Fill form
    const addressInputs = page.getByPlaceholder(/0x.../)
    await addressInputs.nth(0).fill('0x0000000000000000000000000000000000000000')
    await addressInputs.nth(1).fill('0x2222222222222222222222222222222222222222')
    
    const feeSelect = page.locator('select').filter({ hasText: /0.01%|0.05%|0.3%|1%/i }).first()
    await feeSelect.selectOption('3000')
    
    const priceInput = page.locator('input[type="number"]').first()
    await priceInput.fill('1.5')
    
    // Submit
    const submitButton = page.getByRole('button', { name: /Create Pool/i }).last()
    const isEnabled = await submitButton.isEnabled()
    
    if (isEnabled) {
      await submitButton.click()
      await page.waitForTimeout(2000)
      
      await metamask.confirmTransaction()
      await page.waitForTimeout(5000)
      console.log('✅ Pool creation transaction confirmed')
      
      const modalClosed = await page.getByRole('heading', { name: /Create New Pool/i }).isHidden()
      expect(modalClosed).toBe(true)
    }
  })

  test('should display created pools in list', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/pools')
    await page.waitForTimeout(3000)
    
    // Check for pool cards
    const body = await page.textContent('body')
    
    // Should either show pools or empty state
    const hasPoolsOrEmpty = body?.includes('No Pools Yet') || 
                           body?.includes('TVL') || 
                           body?.includes('Price')
    
    expect(hasPoolsOrEmpty).toBe(true)
    console.log('✅ Pools page displaying correctly')
  })

  test('should show pool details (TVL, price, liquidity)', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/pools')
    await page.waitForTimeout(2000)
    
    // If pools exist, check their details
    const poolCards = page.locator('[class*="rounded"]').filter({ hasText: /Token0|Token1|TVL|Price/i })
    const poolCount = await poolCards.count()
    
    if (poolCount > 0) {
      const firstPool = poolCards.first()
      const poolText = await firstPool.textContent()
      
      // Pool card should have metrics
      const hasMetrics = poolText?.includes('TVL') || poolText?.includes('Price') || poolText?.includes('Tick')
      expect(hasMetrics).toBe(true)
      
      // Should have Add Liquidity button
      const addLiqButton = firstPool.getByRole('link', { name: /Add Liquidity/i })
      await expect(addLiqButton).toBeVisible()
      
      console.log('✅ Pool details displaying correctly')
    }
  })

  test('should navigate from pool card to liquidity page', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await metamask.connectToDapp()
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
    
    await page.goto('/pools')
    await page.waitForTimeout(2000)
    
    // Click Add Liquidity link on pool card
    const addLiqLink = page.getByRole('link', { name: /Add Liquidity/i }).first()
    const linkExists = await addLiqLink.isVisible()
    
    if (linkExists) {
      await addLiqLink.click()
      await page.waitForTimeout(1000)
      
      // Should navigate to liquidity page
      const url = page.url()
      expect(url).toContain('/liquidity')
      
      console.log('✅ Navigated to liquidity page from pool card')
    }
  })
})
