# Vendor Integration Tests

This directory contains integration tests that span multiple vendor applications.

## Tests

### ERC-8004 Cross-Game Integration

Tests the ERC-8004 Agent-to-Agent (A2A) protocol implementation across multiple games:

- **`erc8004-cross-game.test.ts`** - Cross-game agent discovery and skill verification
- **`verify-erc8004.ts`** - Verification script for ERC-8004 implementation status
- **`test-erc8004-integration.ts`** - Full integration test runner (starts servers, runs tests)

These tests verify that:
- Multiple games can register to the same on-chain registry
- Agents can discover games via their agent cards
- Skills are properly distinct between games
- Cross-game interactions work correctly

## Prerequisites

These tests require vendor apps to be installed:
```bash
git submodule update --init --recursive vendor/
```

Specific apps needed:
- `vendor/caliguland` - Prediction market game
- `vendor/hyperscape` - MMORPG game

## Running Tests

```bash
# Verify ERC-8004 implementation
bun run vendor/tests/verify-erc8004.ts

# Run full integration test
bun run vendor/tests/test-erc8004-integration.ts

# Or run the test directly
bun test vendor/tests/erc8004-cross-game.test.ts
```

## Note

These tests are **optional** - the core Jeju infrastructure works without vendor apps.
They only run if the vendor apps are initialized.

