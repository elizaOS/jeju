#!/usr/bin/env bun

/**
 * Deploy L1 Contracts
 * 
 * Deploys OP-Stack L1 contracts to Base (settlement layer)
 * 
 * Usage:
 *   bun run scripts/deploy/l1-contracts.ts --network testnet
 */

import { $ } from "bun";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    network: { type: "string", default: "testnet" }
  }
});

const network = values.network;

console.log(`🚀 Deploying L1 Contracts to Base (${network})...\n`);

// Check env vars
const requiredVars = [
  "DEPLOYER_PRIVATE_KEY",
  network === "mainnet" ? "BASE_RPC_URL" : "BASE_SEPOLIA_RPC_URL",
  "BASESCAN_API_KEY"
];

for (const envVar of requiredVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing environment variable: ${envVar}`);
    console.error(`   Set in contracts/.env`);
    process.exit(1);
  }
}

// Deploy using Forge
console.log("📦 Running Foundry deployment script...\n");

const result = await $`cd contracts && make deploy-${network}`.nothrow();

if (result.exitCode !== 0) {
  console.error("\n❌ Deployment failed!");
  process.exit(1);
}

console.log("\n✅ L1 contracts deployed successfully!");
console.log("\n📝 Next steps:");
console.log(`   1. Check deployments/${network}/addresses.json`);
console.log(`   2. Update config/chain/${network}.json with addresses`);
console.log(`   3. Generate genesis: bun run scripts/deploy/l2-genesis.ts --network ${network}`);


