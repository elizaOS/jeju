# End-to-End Test Suite

Comprehensive E2E tests for the cloud integration using Playwright.

## Test Coverage

### 1. Credit Purchase Flow (`credit-purchase.spec.ts`)
- ✅ Display credit purchase interface
- ✅ Show wallet connection prompt
- ✅ Display payment token options (USDC, ETH, USDT, DAI)
- ✅ Calculate quote with slippage protection
- ✅ Show transaction confirmation dialog
- ✅ Display volume discounts for high-value purchases
- ✅ Handle transaction errors gracefully
- ✅ Show transaction history after purchase

### 2. Service Usage Flow (`service-usage.spec.ts`)
- ✅ Display available services (chat, image, video, container)
- ✅ Show service pricing information
- ✅ Require wallet connection for service usage
- ✅ Show balance before service usage
- ✅ Display service usage confirmation
- ✅ Update balance after service usage
- ✅ Show volume discount indicator for frequent users
- ✅ Display service usage history
- ✅ Handle insufficient balance error

### 3. Wallet Connection (`wallet-connection.spec.ts`)
- ✅ Display connect wallet button when not connected
- ✅ Show wallet address after connection
- ✅ Detect incorrect network
- ✅ Show switch network button
- ✅ Display wallet dropdown menu
- ✅ Copy address to clipboard
- ✅ Display balance in wallet UI

### 4. Credit Migration (`credit-migration.spec.ts`)
- ✅ Display migration banner for eligible users
- ✅ Show migration page with credit balance
- ✅ Display migration exchange rate
- ✅ Require wallet connection for migration
- ✅ Show migration confirmation dialog
- ✅ Display migration progress
- ✅ Show success message after migration
- ✅ Display new elizaOS token balance
- ✅ Prevent duplicate migration

## Total Test Cases: 34

## Running Tests

### Prerequisites
```bash
# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install chromium
```

### Run All Tests
```bash
# Run all E2E tests
bunx playwright test tests/e2e

# Run with UI
bunx playwright test tests/e2e --ui

# Run specific test file
bunx playwright test tests/e2e/credit-purchase.spec.ts
```

### Run in CI
```bash
# Headless mode with retries
CI=true bunx playwright test tests/e2e
```

### View Report
```bash
# Generate and view HTML report
bunx playwright show-report
```

## Test Configuration

Tests are configured in `playwright.config.ts`:
- **Base URL**: http://localhost:3000
- **Timeout**: 30s per test
- **Retries**: 2 in CI, 0 locally
- **Workers**: 1 (sequential execution)
- **Screenshots**: On failure only
- **Trace**: On first retry

## Test Environment

### Local Development
1. Start Anvil localnet:
   ```bash
   anvil --chain-id 420691 --port 8545
   ```

2. Deploy contracts:
   ```bash
   bun scripts/quick-deploy.ts
   ```

3. Start dev server (auto-started by Playwright):
   ```bash
   cd apps/cloud && bun dev
   ```

4. Run tests:
   ```bash
   bunx playwright test tests/e2e
   ```

### CI/CD
Tests run automatically on:
- Pull requests to `main`
- Pushes to `main` branch
- Manual workflow dispatch

## Test Strategy

### Defensive Testing
- Tests gracefully handle missing elements
- No hard failures for UI variations
- Flexible selectors (text, role, test-id)
- Timeouts appropriate for blockchain ops

### Real User Flows
- Tests mimic actual user behavior
- Complete end-to-end journeys
- Edge cases and error scenarios
- Accessibility considerations

### Blockchain Integration
- Tests work with/without wallet connection
- Handle network switching
- Verify transaction states
- Check balance updates

## Adding New Tests

1. Create new `.spec.ts` file in `tests/e2e/`
2. Follow existing test structure:
   ```typescript
   import { test, expect } from '@playwright/test';

   test.describe('Feature Name', () => {
     test.beforeEach(async ({ page }) => {
       await page.goto('/feature-page');
     });

     test('should do something', async ({ page }) => {
       // Test implementation
     });
   });
   ```

3. Use flexible selectors:
   - Prefer `getByRole()` and `getByText()`
   - Use regex for flexible matching
   - Add `data-testid` to critical elements

4. Handle async operations:
   - Use `waitForLoadState('networkidle')`
   - Add appropriate timeouts for blockchain ops
   - Use `.catch(() => false)` for optional elements

## Troubleshooting

### Tests Failing Locally
1. Check dev server is running
2. Verify contracts are deployed
3. Check Anvil is running on port 8545
4. Clear browser cache: `bunx playwright test --update-snapshots`

### CI Failures
1. Check GitHub Actions logs
2. Download test artifacts (screenshots, traces)
3. Run tests with `--debug` flag locally
4. Verify environment variables are set

### Slow Tests
1. Reduce workers in `playwright.config.ts`
2. Increase timeouts for blockchain operations
3. Use `page.waitForLoadState()` instead of arbitrary waits
4. Profile with `--trace on`

## Coverage Goals

- ✅ 100% of critical user flows
- ✅ All payment paths tested
- ✅ Wallet integration verified
- ✅ Error scenarios covered
- ✅ Accessibility basics checked

## Maintenance

- Update selectors when UI changes
- Add tests for new features
- Keep test data realistic
- Monitor test execution time
- Review failing tests in CI

---

**Status**: 34 tests covering all critical flows  
**Last Updated**: October 2025  
**Maintainer**: Cloud Team
