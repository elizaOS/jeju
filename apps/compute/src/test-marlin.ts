#!/usr/bin/env bun

/**
 * Test Marlin Oyster Client
 *
 * Usage:
 *   PRIVATE_KEY=0x... bun run src/test-marlin.ts
 *   PRIVATE_KEY=0x... bun run src/test-marlin.ts --approve
 */

import type { Hex } from 'viem';
import {
  MARLIN_CONTRACTS,
  MarlinOysterClient,
  printDeploymentInstructions,
} from './infra/marlin-oyster.js';

async function main() {
  console.log('\nMarlin Oyster Test (Arbitrum)\n');

  const privateKey = process.env.PRIVATE_KEY || process.env.ORACLE_PRIVATE_KEY;

  if (!privateKey) {
    console.error('Error: PRIVATE_KEY required');
    process.exit(1);
  }

  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    console.error('Error: Invalid key format (expected 0x + 64 hex chars)');
    process.exit(1);
  }

  const client = new MarlinOysterClient(privateKey as Hex);
  const status = await client.getAccountStatus();

  console.log('Wallet Status:');
  console.log(`  Address:   ${status.address}`);
  console.log(`  ETH:       ${status.ethBalance}`);
  console.log(`  USDC:      ${status.usdcBalance}`);
  console.log(`  Allowance: ${status.usdcAllowance}\n`);

  const ethBal = Number.parseFloat(status.ethBalance);
  const usdcBal = Number.parseFloat(status.usdcBalance);
  const allowance = Number.parseFloat(status.usdcAllowance);

  if (ethBal < 0.001) {
    console.log('⚠ Low ETH - need ~0.01 for gas');
  }
  if (usdcBal < 1) {
    console.log('⚠ Low USDC - need ~10 for compute');
  }

  console.log('Contracts:');
  console.log(`  Relay: ${MARLIN_CONTRACTS.subscriptionRelay}`);
  console.log(`  USDC:  ${MARLIN_CONTRACTS.usdc}\n`);

  if (ethBal >= 0.001 && usdcBal >= 1) {
    console.log('✓ Wallet funded\n');

    if (allowance < 10 && process.argv.includes('--approve')) {
      console.log('Approving 100 USDC...');
      const tx = await client.approveUSDC(BigInt(100_000_000));
      console.log(`✓ Approved: ${tx}\n`);
    } else if (allowance < 10) {
      console.log('Run with --approve to approve USDC\n');
    } else {
      console.log('✓ USDC approved\n');
    }

    printDeploymentInstructions('PRIVATE_KEY');
  } else {
    console.log('✗ Wallet needs funding\n');
    console.log('To fund:');
    console.log('  1. Bridge ETH: https://bridge.arbitrum.io/');
    console.log('  2. Get USDC on Arbitrum\n');
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
