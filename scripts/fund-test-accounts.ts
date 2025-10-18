#!/usr/bin/env bun
/**
 * Fund test accounts with ELIZA tokens for localnet testing
 */

import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const ELIZA_TOKEN = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Anvil test accounts 1-5
const TEST_ACCOUNTS = [
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Account #1
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Account #2
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Account #3
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // Account #4
  '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', // Account #5
];

const AMOUNT = parseEther('10000'); // 10,000 ELIZA per account

async function main() {
  console.log('Funding test accounts with ELIZA tokens...\n');

  const account = privateKeyToAccount(DEPLOYER_KEY as `0x${string}`);

  const publicClient = createPublicClient({
    chain: foundry,
    transport: http('http://localhost:8545'),
  });

  const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport: http('http://localhost:8545'),
  });

  const elizaABI = [
    {
      name: 'transfer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ type: 'bool' }],
    },
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ type: 'uint256' }],
    },
  ] as const;

  for (const recipient of TEST_ACCOUNTS) {
    try {
      console.log(`Funding ${recipient}...`);

      const hash = await walletClient.writeContract({
        address: ELIZA_TOKEN as `0x${string}`,
        abi: elizaABI,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, AMOUNT],
      });

      await publicClient.waitForTransactionReceipt({ hash });

      const balance = await publicClient.readContract({
        address: ELIZA_TOKEN as `0x${string}`,
        abi: elizaABI,
        functionName: 'balanceOf',
        args: [recipient as `0x${string}`],
      });

      console.log(`✅ Sent 10,000 ELIZA to ${recipient}`);
      console.log(`   Balance: ${Number(balance) / 1e18} ELIZA\n`);
    } catch (error: any) {
      console.error(`❌ Failed to fund ${recipient}:`, error.message);
    }
  }

  console.log('✅ All accounts funded!');
}

main().catch(console.error);
