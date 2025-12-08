# Shared Test Infrastructure

This directory contains shared testing utilities and configurations used across all Jeju monorepo projects.

## Contents

### Configuration Files

- **`synpress.config.base.ts`** - Unified Synpress/Playwright configuration
  - `createJejuSynpressConfig()` - Standardized test config
  - `createJejuWalletSetup()` - Unified MetaMask wallet setup

- **`playwright.config.base.ts`** - Base Playwright configuration (legacy, prefer Synpress)

### Fixtures

- **`fixtures/synpress-wallet.ts`** - MetaMask wallet fixtures and helper functions
  - `connectWallet()` - Helper to connect wallet to dApp
  - `approveTransaction()` - Helper to approve transactions
  - `signMessage()` - Helper to sign messages
  - `getWalletAddress()` - Get displayed wallet address
  - `verifyWalletConnected()` - Verify wallet connection

- **`fixtures/wallet.ts`** - Dappwright wallet fixtures (legacy)

### Helpers

- **`helpers/screenshots.ts`** - Screenshot capture utilities
- **`helpers/navigation.ts`** - Navigation helpers
- **`helpers/error-detection.ts`** - Error detection utilities
- **`helpers/contracts.ts`** - Smart contract interaction helpers

### Wallet Setup

- **`wallet-setup/jeju.setup.ts`** - Standard Jeju network wallet configuration

## Quick Start

### Using Synpress (Recommended)

1. **Import the shared config in your app's synpress.config.ts:**

\`\`\`typescript
import { createJejuSynpressConfig, createJejuWalletSetup } from '../../tests/shared/synpress.config.base';

export default createJejuSynpressConfig({
  appName: 'my-app',
  port: 4001,
  testDir: './tests/wallet',
});

export const basicSetup = createJejuWalletSetup();
\`\`\`

2. **Write your test:**

\`\`\`typescript
import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup))

test('connects wallet', async ({ context, page, metamaskPage, extensionId }) => {
  const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)
  await page.goto('/')
  await metamask.connectToDapp()
})
\`\`\`

3. **Run your tests:**

\`\`\`bash
bun run test:wallet
\`\`\`

## Documentation

- **[SYNPRESS_MIGRATION.md](./SYNPRESS_MIGRATION.md)** - Complete guide to unified Synpress setup
- **[Synpress Official Docs](https://synpress.io)** - Synpress documentation

## Test Account

All tests use the standard Hardhat/Anvil test account:

- **Address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Private Key:** `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **Password:** `Test1234!`

## Network Configuration

- **Name:** Jeju Local
- **Chain ID:** 1337
- **RPC URL:** http://localhost:9545
- **Symbol:** ETH

## Projects Using This Infrastructure

✅ All main apps (bazaar, gateway, ehorse, documentation)
✅ All vendor projects (babylon, hyperscape, leaderboard, otc-desk)
✅ All cloud apps (9 total)

## Contributing

When adding new shared test utilities:

1. Keep utilities generic and reusable
2. Document all exported functions
3. Add TypeScript types
4. Update this README
5. Add usage examples

## Support

For questions or issues with shared test infrastructure:

1. Check the [SYNPRESS_MIGRATION.md](./SYNPRESS_MIGRATION.md) guide
2. Review existing test examples in apps/
3. Ask in team chat

