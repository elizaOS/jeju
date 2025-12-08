/**
import type { Page } from "@playwright/test";
 * Swap - Complete Real Transaction Flow
 * Tests ACTUAL token swaps with balance verification
 */

import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'
import { createPublicClient, http, parseAbi } from 'viem'
import { jejuLocalnet } from '../../config/multi-chain'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

const publicClient = createPublicClient({
  chain: jejuLocalnet,
  transport: http('http://localhost:9545'),
22-swap-complete-real.spec.ts.backup
