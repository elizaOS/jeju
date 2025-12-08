#!/usr/bin/env bun

/**
 * Check wallet balances on Arbitrum
 */

import type { Hex } from 'viem';
import { createPublicClient, formatEther, formatUnits, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';

const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http('https://arb1.arbitrum.io/rpc'),
});

interface WalletResult {
  name: string;
  address: string;
  eth: number;
  usdc: number;
  funded: boolean;
  key: string;
}

async function checkWallet(
  name: string,
  privateKey: string
): Promise<WalletResult | null> {
  const key = (
    privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  ) as Hex;
  if (key.length !== 66) return null;

  const account = privateKeyToAccount(key);

  const [ethBalance, usdcBalance] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: USDC,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [account.address],
    }) as Promise<bigint>,
  ]);

  const eth = Number(formatEther(ethBalance));
  const usdc = Number(formatUnits(usdcBalance, 6));
  const funded = eth >= 0.001 && usdc >= 1;

  console.log(`${funded ? '✓' : '✗'} ${name}`);
  console.log(`  ${account.address}`);
  console.log(`  ${eth.toFixed(6)} ETH, ${usdc.toFixed(2)} USDC`);

  return { name, address: account.address, eth, usdc, funded, key };
}

async function main() {
  console.log('\nWallet Balances (Arbitrum)\n');

  const wallets = [
    { name: 'ORACLE_PRIVATE_KEY', key: process.env.ORACLE_PRIVATE_KEY },
    { name: 'DEPLOYER_PRIVATE_KEY', key: process.env.DEPLOYER_PRIVATE_KEY },
    {
      name: 'BABYLON_GAME_PRIVATE_KEY',
      key: process.env.BABYLON_GAME_PRIVATE_KEY,
    },
    { name: 'PRIVATE_KEY', key: process.env.PRIVATE_KEY },
  ].filter((w) => w.key);

  const results: WalletResult[] = [];
  for (const w of wallets) {
    if (w.key) {
      const result = await checkWallet(w.name, w.key);
      if (result) results.push(result);
    }
  }

  const funded = results.find((r) => r.funded);

  console.log('\n─────────────────────────────────────');
  if (funded) {
    console.log(`✓ Funded wallet: ${funded.name}`);
    console.log(`  PRIVATE_KEY=${funded.key} bun run demo:bun`);
  } else {
    console.log('✗ No funded wallets');
    console.log('  Need: ~0.01 ETH + ~10 USDC on Arbitrum');
  }
  console.log('─────────────────────────────────────\n');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
