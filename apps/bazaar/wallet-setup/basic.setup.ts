import { defineWalletSetup } from '@synthetixio/synpress'
import { MetaMask } from '@synthetixio/synpress/playwright'

const PASSWORD = 'Test1234!'
const SEED_PHRASE = 'test test test test test test test test test test test junk'
const JEJU_CHAIN_ID = parseInt(process.env.CHAIN_ID || '420691')
const JEJU_RPC_URL = process.env.L2_RPC_URL || process.env.JEJU_RPC_URL || 'http://localhost:9545'

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD)

  // Import test wallet using seed phrase (Hardhat test account #0)
  await metamask.importWallet(SEED_PHRASE)

  // Add Jeju network
  await metamask.addNetwork({
    name: 'Jeju',
    rpcUrl: JEJU_RPC_URL,
    chainId: JEJU_CHAIN_ID,
    symbol: 'ETH',
  })

  // Switch to Jeju network
  await metamask.switchNetwork('Jeju')
})

