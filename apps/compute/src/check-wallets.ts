#!/usr/bin/env bun

/**
 * Check wallet balances for Jeju Compute (Base network)
 */

import type { Hex } from 'viem';
import { createPublicClient, formatEther, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

interface WalletResult {
  name: string;
  address: string;
  balance: number;
  funded: boolean;
  key: string;
}

interface PublicClient {
  getBalance: (params: { address: Hex }) => Promise<bigint>;
}

async function checkWallet(
  name: string,
  privateKey: string,
  client: PublicClient
): Promise<WalletResult | null> {
  const key = (
    privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  ) as Hex;
  if (key.length !== 66) return null;

  const account = privateKeyToAccount(key);
  const balance = await client.getBalance({ address: account.address });
  const eth = Number(formatEther(balance));
  const funded = eth >= 0.001;

  console.log(`${funded ? '✓' : '✗'} ${name}`);
  console.log(`  ${account.address}`);
  console.log(`  ${eth.toFixed(6)} ETH`);

  return { name, address: account.address, balance: eth, funded, key };
}

async function main() {
  console.log('\nJeju Compute Wallet Check\n');

  const wallets = [
    { name: 'ORACLE_PRIVATE_KEY', key: process.env.ORACLE_PRIVATE_KEY },
    { name: 'DEPLOYER_PRIVATE_KEY', key: process.env.DEPLOYER_PRIVATE_KEY },
    { name: 'JEJU_GAME_PRIVATE_KEY', key: process.env.JEJU_GAME_PRIVATE_KEY },
    { name: 'PRIVATE_KEY', key: process.env.PRIVATE_KEY },
  ].filter((w) => w.key);

  // Check Base Sepolia (Testnet)
  console.log('─── Base Sepolia (Testnet) ───\n');
  const sepoliaClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const sepoliaResults: WalletResult[] = [];
  for (const w of wallets) {
    if (w.key) {
      const result = await checkWallet(w.name, w.key, sepoliaClient);
      if (result) sepoliaResults.push(result);
    }
  }

  // Check Base Mainnet
  console.log('\n─── Base Mainnet ───\n');
  const mainnetClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  const mainnetResults: WalletResult[] = [];
  for (const w of wallets) {
    if (w.key) {
      const result = await checkWallet(w.name, w.key, mainnetClient);
      if (result) mainnetResults.push(result);
    }
  }

  // Summary
  console.log('\n─────────────────────────────────────');
  
  const sepoliaFunded = sepoliaResults.find((r) => r.funded);
  const mainnetFunded = mainnetResults.find((r) => r.funded);

  if (sepoliaFunded) {
    console.log(`✓ Testnet wallet: ${sepoliaFunded.name}`);
    console.log(`  PRIVATE_KEY=${sepoliaFunded.key} bun run demo`);
  }
  
  if (mainnetFunded) {
    console.log(`✓ Mainnet wallet: ${mainnetFunded.name}`);
  }

  if (!sepoliaFunded && !mainnetFunded) {
    console.log('✗ No funded wallets found');
    console.log('  Need: ~0.01 ETH on Base Sepolia or Base Mainnet');
  }
  
  console.log('─────────────────────────────────────\n');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
