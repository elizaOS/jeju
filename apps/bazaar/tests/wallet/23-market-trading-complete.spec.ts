/**
 * Market Trading - Complete Real Flow
 * Tests ACTUAL market betting with position verification
 */

import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'
import { createPublicClient, http, parseAbi, parseEther } from 'viem'
import { jejuLocalnet } from '../../config/multi-chain'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

const publicClient = createPublicClient({
  chain: jejuLocalnet,
  transport: http('http://localhost:9545'),
23-market-trading-complete.spec.ts.backup
