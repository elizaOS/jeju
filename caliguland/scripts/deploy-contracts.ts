#!/usr/bin/env bun
/**
 * Deploy VibeVM Contracts to local Anvil or testnet
 * Pattern copied from Among Us deployment
 */

import { ethers } from 'ethers';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const CONTRACTS_DIR = join(import.meta.dir, '../contracts');

console.log('🚀 Deploying VibeVM Contracts...\n');

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const privateKey = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`👤 Deployer: ${wallet.address}`);
  console.log(`📡 RPC: ${RPC_URL}\n`);

  // TODO: Deploy PredictionOracle
  // For now, save placeholder addresses
  
  const addresses = {
    predictionOracle: '0x0000000000000000000000000000000000000000',
    chainId: Number(await provider.getNetwork().then(n => n.chainId)),
    deployer: wallet.address,
    timestamp: Date.now()
  };

  writeFileSync(
    join(CONTRACTS_DIR, 'addresses.json'),
    JSON.stringify(addresses, null, 2)
  );

  console.log('✅ Addresses saved to contracts/addresses.json');
  console.log('⚠️  Note: Actual deployment needs forge script\n');
}

main().catch(err => {
  console.error('❌ Deployment failed:', err);
  process.exit(1);
});

