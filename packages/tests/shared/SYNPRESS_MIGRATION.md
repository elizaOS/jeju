# Synpress Unified Testing Setup

This document describes the unified Synpress testing infrastructure for the Jeju monorepo.

## Overview

All apps and vendor projects now use a **unified Synpress configuration** for wallet testing with MetaMask. This provides:

- **Consistent wallet setup** across all projects
- **Shared test infrastructure** reducing duplication
- **Standardized MetaMask configuration**
- **Unified cache management**

## Architecture

### Shared Configuration

**Location:** `/tests/shared/synpress.config.base.ts`

**Exports:**
- `createJejuSynpressConfig(config)` - Creates standardized Playwright/Synpress configuration
- `createJejuWalletSetup()` - Creates unified MetaMask wallet setup

### Wallet Configuration

**Network:** Jeju Local
- **Chain ID:** 1337
- **RPC URL:** http://localhost:9545
- **Symbol:** ETH

**Test Account:**
- **Address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Private Key:** Hardhat/Anvil test account #0
- **Password:** `Test1234!`

## Usage

### 1. Configuration

Each app has its own `synpress.config.ts` that imports the shared base:

\`\`\`typescript
import { createJejuSynpressConfig, createJejuWalletSetup } from '../../tests/shared/synpress.config.base';

const APP_PORT = parseInt(process.env.APP_PORT || '4001');

export default createJejuSynpressConfig({
  appName: 'my-app',
  port: APP_PORT,
  testDir: './tests/wallet',
  overrides: {
    timeout: 180000,
    webServer: undefined, // Or specify your dev server command
  },
});

export const basicSetup = createJejuWalletSetup();
\`\`\`

### 2. Writing Tests

\`\`\`typescript
import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { basicSetup } from '../../synpress.config'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

test('should connect MetaMask wallet', async ({ context, page, metamaskPage, extensionId }) => {
  const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

  await page.goto('/')
  
  // Click connect button (adjust selector for your app)
  await page.getByRole('button', { name: /Connect Wallet/i }).click()

  // Connect to dApp in MetaMask
  await metamask.connectToDapp()

  // Verify wallet address is displayed
  await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 15000 })
})
\`\`\`

### 3. Running Tests

\`\`\`bash
# Run all wallet tests
bun run test:wallet

# Run specific test file
bun run test:wallet tests/wallet/01-wallet-connection.spec.ts

# Run in headed mode (see browser)
bun run test:wallet --headed

# Debug mode
bun run test:wallet --debug
\`\`\`

## Projects Using Unified Synpress

### Main Apps
- ✅ apps/bazaar
- ✅ apps/ehorse
- ✅ apps/gateway
- ✅ apps/documentation

### Vendor Projects
- ✅ vendor/babylon
- ✅ vendor/hyperscape
- ✅ vendor/leaderboard
- ✅ vendor/otc-desk

### Cloud Apps
- ✅ vendor/cloud/fake-girlfriend
- ✅ vendor/cloud/coach-matthews
- ✅ vendor/cloud/psychic-ai
- ✅ vendor/cloud/clone-your-crush
- ✅ vendor/cloud/product-mommy
- ✅ vendor/cloud/hot-teacher
- ✅ vendor/cloud/sober-buddy
- ✅ vendor/cloud/immortal-brotherhood
- ✅ vendor/cloud/edad

## MetaMask Actions

The MetaMask fixture provides these common actions:

\`\`\`typescript
// Connect wallet to dApp
await metamask.connectToDapp()

// Approve transaction
await metamask.confirmTransaction()

// Reject transaction
await metamask.rejectTransaction()

// Sign message
await metamask.confirmSignature()

// Switch network
await metamask.switchNetwork('Network Name')

// Add token
await metamask.addToken(tokenAddress, symbol, decimals)
\`\`\`

## Shared Test Helpers

**Location:** `/tests/shared/fixtures/synpress-wallet.ts`

\`\`\`typescript
import { connectWallet, approveTransaction, signMessage } from '../../tests/shared/fixtures/synpress-wallet'

// Helper functions for common wallet operations
await connectWallet(page, metamask)
await approveTransaction(metamask)
await signMessage(metamask)
\`\`\`

## Cache Management

Synpress automatically manages MetaMask extension caching:

- Cache is created on first run
- Reused for subsequent test runs
- Significantly speeds up test execution
- Cache location: `node_modules/.cache/@synthetixio/synpress`

To rebuild cache:
\`\`\`bash
bun run test:wallet:build-cache
# or
npx synpress --force
\`\`\`

## Troubleshooting

### MetaMask not connecting

1. Ensure dev server is running on the correct port
2. Check that `baseURL` in config matches your app
3. Verify wallet selector text matches your UI

### Tests timing out

1. Increase timeout in synpress config overrides
2. Use `--timeout` flag: `bun run test:wallet --timeout=300000`
3. Check that network is accessible

### Cache issues

1. Delete cache: `rm -rf node_modules/.cache/@synthetixio/synpress`
2. Rebuild: `npx synpress --force`
3. Run tests again

## Migration Notes

### What Changed

1. **Removed all `playwright.config.ts` files** - Now using synpress.config.ts exclusively
2. **Consolidated wallet setups** - All use shared `createJejuWalletSetup()`
3. **Updated test imports** - Import `{ basicSetup }` from `synpress.config` instead of local wallet-setup files
4. **Standardized test scripts** - All use `playwright test --config=synpress.config.ts`

### Breaking Changes

None! The migration maintains backward compatibility with existing test patterns.

## Best Practices

1. **Import from synpress.config** - Always use `import { basicSetup } from '../../synpress.config'`
2. **Use basicSetup.walletPassword** - Don't hardcode the password
3. **Reuse MetaMask instance** - Create once per test, reuse for multiple actions
4. **Wait for network requests** - Use `await page.waitForLoadState('networkidle')` after navigation
5. **Increase timeouts for wallet operations** - MetaMask actions can be slow

## Future Improvements

- [ ] Add support for custom test accounts
- [ ] Multi-network test scenarios
- [ ] Shared test data fixtures
- [ ] Performance benchmarking
- [ ] Visual regression testing with wallet states

## Support

For issues or questions about the unified Synpress setup:

1. Check this documentation
2. Review test examples in existing apps
3. Check Synpress docs: https://synpress.io
4. Ask in team chat

---

**Last Updated:** October 2025
**Maintained By:** Engineering Team

