/**
 * @fileoverview Basic wallet setup for Synpress E2E tests
 */

import { defineWalletSetup } from '@synthetixio/synpress';
import { MetaMask } from '@synthetixio/synpress/playwright';

// Test seed phrase - DO NOT USE IN PRODUCTION
const SEED_PHRASE = 'test test test test test test test test test test test junk';
const PASSWORD = 'Tester@1234';

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD);
  
  // Import the test wallet
  await metamask.importWallet(SEED_PHRASE);
  
  // Add custom networks for testing
  // Base mainnet
  await metamask.addNetwork({
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    chainId: 8453,
    symbol: 'ETH',
    blockExplorerUrl: 'https://basescan.org',
  });

  // Jeju testnet (local)
  await metamask.addNetwork({
    name: 'Jeju Testnet',
    rpcUrl: 'http://localhost:8545',
    chainId: 420690,
    symbol: 'ETH',
  });
});

export { SEED_PHRASE, PASSWORD };

