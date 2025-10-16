#!/usr/bin/env bun

/**
 * Generate L2 Genesis
 * 
 * Generates genesis.json and rollup.json for your L3
 * 
 * Usage:
 *   bun run scripts/deploy/l2-genesis.ts --network testnet
 */

import { $ } from "bun";
import { parseArgs } from "util";
import { existsSync } from "fs";
import { join } from "path";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    network: { type: "string", default: "testnet" }
  }
});

const network = values.network;

console.log(`📦 Generating L2 Genesis for ${network}...\n`);

// Check prerequisites
const addressesPath = join(process.cwd(), "contracts", "deployments", network, "addresses.json");

if (!existsSync(addressesPath)) {
  console.error(`❌ L1 deployment addresses not found: ${addressesPath}`);
  console.error(`   Deploy L1 contracts first: bun run scripts/deploy/l1-contracts.ts --network ${network}`);
  process.exit(1);
}

console.log("✅ L1 addresses found");

// Generate genesis using op-node
console.log("\n📝 Generating genesis files...\n");

const result = await $`cd contracts && make genesis-${network}`.nothrow();

if (result.exitCode !== 0) {
  console.error("\n❌ Genesis generation failed!");
  process.exit(1);
}

console.log("\n✅ Genesis files generated!");
console.log(`\n📁 Files created:`);
console.log(`   - contracts/deployments/${network}/genesis.json`);
console.log(`   - contracts/deployments/${network}/rollup.json`);
console.log("\n📝 Next steps:");
console.log("   1. Copy genesis.json to your sequencer node initialization");
console.log("   2. Copy rollup.json to op-node ConfigMap in Kubernetes");
console.log("   3. Deploy infrastructure: bun run start");


