#!/usr/bin/env bun
/**
 * ERC-8004 Integration Verification Script
 * Checks if both games are properly configured for A2A/ERC-8004
 */

import { existsSync } from 'fs';
import { join } from 'path';

console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║                                                                       ║');
console.log('║   🔍 ERC-8004 Integration Verification                             ║');
console.log('║                                                                       ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, message: string) {
  results.push({ name, passed: condition, message });
  const icon = condition ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
}

// 1. Check Caliguland A2A files
console.log('📦 Caliguland Files:\n');

check(
  'Agent Card',
  existsSync('vendor/caliguland/caliguland-game/src/a2a/agentCard.ts'),
  existsSync('vendor/caliguland/caliguland-game/src/a2a/agentCard.ts') ? 'Found' : 'Missing'
);

check(
  'A2A Server',
  existsSync('vendor/caliguland/caliguland-game/src/a2a/server.ts'),
  existsSync('vendor/caliguland/caliguland-game/src/a2a/server.ts') ? 'Found' : 'Missing'
);

check(
  'Registry Client',
  existsSync('vendor/caliguland/caliguland-game/src/a2a/registry.ts'),
  existsSync('vendor/caliguland/caliguland-game/src/a2a/registry.ts') ? 'Found' : 'Missing'
);

check(
  'Integration Tests',
  existsSync('vendor/caliguland/caliguland-game/src/a2a/__tests__/registry-integration.test.ts'),
  existsSync('vendor/caliguland/caliguland-game/src/a2a/__tests__/registry-integration.test.ts') ? 'Found' : 'Missing'
);

// 2. Check Hyperscape A2A files
console.log('\n📦 Hyperscape Files:\n');

check(
  'Agent Card',
  existsSync('vendor/hyperscape/packages/server/src/a2a/agentCard.ts'),
  existsSync('vendor/hyperscape/packages/server/src/a2a/agentCard.ts') ? 'Found' : 'Missing'
);

check(
  'A2A Server',
  existsSync('vendor/hyperscape/packages/server/src/a2a/server.ts'),
  existsSync('vendor/hyperscape/packages/server/src/a2a/server.ts') ? 'Found' : 'Missing'
);

check(
  'Registry Client',
  existsSync('vendor/hyperscape/packages/server/src/a2a/registry.ts'),
  existsSync('vendor/hyperscape/packages/server/src/a2a/registry.ts') ? 'Found' : 'Missing'
);

check(
  'Integration Tests',
  existsSync('vendor/hyperscape/packages/server/src/a2a/__tests__/a2a-integration.test.ts'),
  existsSync('vendor/hyperscape/packages/server/src/a2a/__tests__/a2a-integration.test.ts') ? 'Found' : 'Missing'
);

// 3. Check contracts
console.log('\n📜 ERC-8004 Contracts:\n');

check(
  'IdentityRegistry',
  existsSync('contracts/src/registry/IdentityRegistry.sol'),
  existsSync('contracts/src/registry/IdentityRegistry.sol') ? 'Found' : 'Missing'
);

check(
  'ReputationRegistry',
  existsSync('contracts/src/registry/ReputationRegistry.sol'),
  existsSync('contracts/src/registry/ReputationRegistry.sol') ? 'Found' : 'Missing'
);

check(
  'ValidationRegistry',
  existsSync('contracts/src/registry/ValidationRegistry.sol'),
  existsSync('contracts/src/registry/ValidationRegistry.sol') ? 'Found' : 'Missing'
);

check(
  'Deploy Script',
  existsSync('contracts/script/DeployLiquiditySystem.s.sol'),
  existsSync('contracts/script/DeployLiquiditySystem.s.sol') ? 'Found' : 'Missing'
);

// 4. Check tests
console.log('\n🧪 Integration Tests:\n');

check(
  'Cross-Game Test',
  existsSync('vendor/tests/erc8004-cross-game.test.ts'),
  existsSync('vendor/tests/erc8004-cross-game.test.ts') ? 'Found' : 'Missing'
);

check(
  'Test Runner',
  existsSync('vendor/tests/test-erc8004-integration.ts'),
  existsSync('vendor/tests/test-erc8004-integration.ts') ? 'Found' : 'Missing'
);

// 5. Check build artifacts
console.log('\n🏗️  Build Verification:\n');

check(
  'Hyperscape Build',
  existsSync('vendor/hyperscape/packages/server/dist/index.js'),
  existsSync('vendor/hyperscape/packages/server/dist/index.js') ? 'Built successfully' : 'Not built yet - run: cd vendor/hyperscape/packages/server && bun run build'
);

// Summary
const totalChecks = results.length;
const passedChecks = results.filter(r => r.passed).length;
const failedChecks = totalChecks - passedChecks;

console.log('\n' + '═'.repeat(71));
console.log(`\n📊 Results: ${passedChecks}/${totalChecks} checks passed\n`);

if (failedChecks === 0) {
  console.log('✅ All checks PASSED! ERC-8004 integration is complete.\n');
  console.log('Next steps:');
  console.log('  1. Deploy contracts: cd contracts && forge script script/DeployLiquiditySystem.s.sol --rpc-url http://localhost:8545 --broadcast');
  console.log('  2. Start Caliguland: cd vendor/caliguland && ENABLE_BLOCKCHAIN=true bun run dev');
  console.log('  3. Start Hyperscape: cd vendor/hyperscape && ENABLE_BLOCKCHAIN=true npm run dev');
  console.log('  4. Verify agent cards:');
  console.log('     curl http://localhost:5008/.well-known/agent-card.json');
  console.log('     curl http://localhost:5555/.well-known/agent-card.json');
  console.log('  5. Run integration tests: bun run vendor/tests/test-erc8004-integration.ts\n');
} else {
  console.log(`❌ ${failedChecks} check(s) FAILED. Review the output above.\n`);
  process.exit(1);
}

