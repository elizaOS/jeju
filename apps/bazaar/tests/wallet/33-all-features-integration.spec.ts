/**
import type { Page } from "@playwright/test";
 * All Features Integration Test
 * Comprehensive test of ALL Bazaar features in one session
 */

import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'
import { createPublicClient, http } from 'viem'
import { jejuLocalnet } from '../../config/multi-chain'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

const publicClient = createPublicClient({
  chain: jejuLocalnet,
  transport: http('http://localhost:9545'),
33-all-features-integration.spec.ts.backup
