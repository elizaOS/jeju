#!/usr/bin/env bun

/**
 * Marlin Oyster E2E Test
 *
 * Usage:
 *   PRIVATE_KEY=0x... bun run src/test-marlin-e2e.ts
 *   PRIVATE_KEY=0x... bun run src/test-marlin-e2e.ts --deploy
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Hex } from 'viem';
import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
import {
  generateBabylonWorkerCode,
  MARLIN_CONTRACTS,
  MarlinOysterClient,
} from './infra/marlin-oyster.js';

const CLI_PATH = join(import.meta.dir, '..', 'oyster-serverless');
const TEST_DIR = join(import.meta.dir, '..', 'test-marlin-project');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve(fn())
    .then(() => {
      results.push({ name, passed: true });
      console.log(`  ✓ ${name}`);
    })
    .catch((e: Error) => {
      results.push({ name, passed: false, error: e.message });
      console.log(`  ✗ ${name}: ${e.message}`);
    });
}

async function main() {
  console.log('\nMarlin Oyster E2E Test\n');

  const privateKey = process.env.PRIVATE_KEY || process.env.ORACLE_PRIVATE_KEY;
  const shouldDeploy = process.argv.includes('--deploy');

  if (!privateKey) {
    console.error('Error: PRIVATE_KEY required');
    process.exit(1);
  }

  // CLI
  console.log('CLI:');
  await test('Binary exists', () => {
    if (!existsSync(CLI_PATH)) throw new Error('Not found');
  });
  await test('Version check', () => {
    execSync(`${CLI_PATH} --version`, { encoding: 'utf8' });
  });

  // Arbitrum
  console.log('\nArbitrum:');
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http('https://arb1.arbitrum.io/rpc'),
  });

  await test('RPC connection', async () => {
    await publicClient.getBlockNumber();
  });
  await test('Subscription Relay contract', async () => {
    const code = await publicClient.getBytecode({
      address: MARLIN_CONTRACTS.subscriptionRelay,
    });
    if (!code || code === '0x') throw new Error('No code');
  });
  await test('Relay contract', async () => {
    const code = await publicClient.getBytecode({
      address: MARLIN_CONTRACTS.relay,
    });
    if (!code || code === '0x') throw new Error('No code');
  });
  await test('USDC contract', async () => {
    const code = await publicClient.getBytecode({
      address: MARLIN_CONTRACTS.usdc,
    });
    if (!code || code === '0x') throw new Error('No code');
  });

  // Wallet
  console.log('\nWallet:');
  const client = new MarlinOysterClient(privateKey as Hex);
  let walletFunded = false;

  await test('Client init', () => {
    if (!client.address) throw new Error('No address');
  });
  await test('Balance check', async () => {
    const status = await client.getAccountStatus();
    const eth = Number.parseFloat(status.ethBalance);
    const usdc = Number.parseFloat(status.usdcBalance);
    walletFunded = eth >= 0.001 && usdc >= 1;
    console.log(
      `       ETH: ${status.ethBalance}, USDC: ${status.usdcBalance}`
    );
  });

  // Worker
  console.log('\nWorker:');
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });

  await test('Create project', () => {
    mkdirSync(TEST_DIR, { recursive: true });
  });
  await test('Generate code', () => {
    const code = generateBabylonWorkerCode({
      gameContractAddress: '0x0000000000000000000000000000000000000000',
    });
    writeFileSync(join(TEST_DIR, 'worker.js'), code);
  });

  // Deploy
  console.log('\nDeploy:');
  if (!walletFunded) {
    console.log(`  - Skipped (wallet needs funding: ${client.address})`);
  } else if (!shouldDeploy) {
    console.log('  - Skipped (run with --deploy)');
  } else {
    await test('Deploy worker', async () => {
      process.chdir(TEST_DIR);
      execSync(
        `${CLI_PATH} deploy --wallet-private-key ${privateKey} --minified`,
        {
          encoding: 'utf8',
          timeout: 120000,
        }
      );
    });
  }

  // Cleanup
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n─────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('─────────────────────────────────────\n');

  if (failed === 0) {
    console.log('✓ All tests passed\n');
    if (!walletFunded) {
      console.log(`Fund ${client.address} on Arbitrum to deploy`);
      console.log('  Need: ~0.01 ETH + ~10 USDC\n');
    }
  } else {
    console.log('✗ Some tests failed\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
