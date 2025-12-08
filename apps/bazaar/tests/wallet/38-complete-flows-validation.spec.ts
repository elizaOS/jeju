/**
import type { Page } from "@playwright/test";
 * Complete Flows Validation - ALL Features Working
 * This test PROVES every flow works end-to-end with deployed contracts
 */

import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'
import { createPublicClient, http, parseEther, parseAbi } from 'viem'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

const RPC_URL = 'http://localhost:9545'

const publicClient = createPublicClient({
  chain: {
    id: 1337,
    name: 'Anvil',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [RPC_URL] }
    }
  },
  transport: http(RPC_URL),
38-complete-flows-validation.spec.ts.backup
