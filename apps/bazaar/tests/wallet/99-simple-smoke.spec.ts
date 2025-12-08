import { testWithSynpress } from '@synthetixio/synpress'
import type { Page } from "@playwright/test";
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

test.describe('Simple Smoke Test', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    const title = await page.textContent('h1')
    console.log('Page title:', title)
    expect(title).toContain('Bazaar')
  })
})
