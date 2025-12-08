#!/usr/bin/env bun

/**
 * Storage Verification
 */

import { createDecentralizedStorage } from './storage/decentralized-storage.js';

const TEST_CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

const ARWEAVE_GATEWAYS = [
  'https://arweave.net',
  'https://ar-io.net',
  'https://g8way.io',
  'https://arweave.dev',
];

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://dweb.link/ipfs',
  'https://gateway.pinata.cloud/ipfs',
];

async function testGateway(
  gateway: string,
  path: string
): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${gateway}${path}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return { ok: response.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

async function main() {
  console.log('\nStorage Verification\n');

  // Test Arweave gateways
  console.log('Arweave Gateways:');
  let arweaveHealthy = 0;
  for (const gateway of ARWEAVE_GATEWAYS) {
    const result = await testGateway(gateway, '/info');
    if (result.ok) arweaveHealthy++;
    console.log(
      `  ${result.ok ? '✓' : '✗'} ${gateway} ${result.ok ? `(${result.ms}ms)` : ''}`
    );
  }

  // Test IPFS gateways
  console.log('\nIPFS Gateways:');
  let ipfsHealthy = 0;
  for (const gateway of IPFS_GATEWAYS) {
    const result = await testGateway(gateway, `/${TEST_CID}`);
    if (result.ok) ipfsHealthy++;
    console.log(
      `  ${result.ok ? '✓' : '✗'} ${gateway} ${result.ok ? `(${result.ms}ms)` : ''}`
    );
  }

  // Summary
  console.log('\n─────────────────────────────────────');
  console.log(`Arweave: ${arweaveHealthy}/${ARWEAVE_GATEWAYS.length} healthy`);
  console.log(`IPFS: ${ipfsHealthy}/${IPFS_GATEWAYS.length} healthy`);
  console.log('─────────────────────────────────────\n');

  const decentralized = arweaveHealthy >= 2 && ipfsHealthy >= 2;
  console.log(
    decentralized
      ? '✓ Decentralized (no single point of failure)\n'
      : '⚠ Limited redundancy\n'
  );

  const storage = createDecentralizedStorage({ verbose: false });
  await storage.printHealthReport();
}

main().catch(console.error);
