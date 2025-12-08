#!/usr/bin/env bun

/**
 * Verify Arweave Upload (devnet)
 *
 * Run: PRIVATE_KEY=0x... bun run src/verify-arweave.ts
 */

import type { Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

async function main(): Promise<void> {
  console.log('\nArweave Upload Test\n');

  let privateKey = process.env.PRIVATE_KEY as Hex | undefined;
  if (!privateKey) {
    privateKey = generatePrivateKey();
    console.log('No PRIVATE_KEY provided, using ephemeral key\n');
  }

  const account = privateKeyToAccount(privateKey);
  console.log(`Wallet: ${account.address}`);

  const IrysModule = await import('@irys/sdk');
  const Irys = IrysModule.default;

  const irys = new Irys({
    network: 'devnet',
    token: 'ethereum',
    key: privateKey,
  });
  await irys.ready();

  const balance = await irys.getLoadedBalance();
  console.log(`Balance: ${irys.utils.fromAtomic(balance)} ETH`);

  if (Number(irys.utils.fromAtomic(balance)) < 0.001) {
    console.log('Funding devnet...');
    await irys.fund(100000000000000);
    console.log('✓ Funded');
  }

  const testData = {
    type: 'test',
    timestamp: Date.now(),
    wallet: account.address,
  };

  console.log('\nUploading...');
  const receipt = await irys.upload(Buffer.from(JSON.stringify(testData)), {
    tags: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'babylon' },
    ],
  });

  console.log(`\n✓ Uploaded`);
  console.log(`TX: ${receipt.id}`);
  console.log(`URL: https://arweave.net/${receipt.id}`);

  await new Promise((r) => setTimeout(r, 2000));

  const response = await fetch(`https://arweave.net/${receipt.id}`);
  if (response.ok) {
    const downloaded = await response.json() as { wallet: string };
    if (downloaded.wallet === account.address) {
      console.log('✓ Verified\n');
    }
  } else {
    console.log('⚠ Pending propagation\n');
  }
}

if (import.meta.main) {
  main();
}
