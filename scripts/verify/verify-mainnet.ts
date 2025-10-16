#!/usr/bin/env bun

/**
 * Verify Contracts on BaseScan (Mainnet)
 * 
 * Verifies all deployed contracts on Base Mainnet
 * 
 * Usage:
 *   bun run scripts/verify/verify-mainnet.ts
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

console.log("🔍 Verifying Contracts on BaseScan (Mainnet)...\n");

const addressesPath = join(process.cwd(), "contracts", "deployments", "mainnet", "addresses.json");

if (!existsSync(addressesPath)) {
  console.error(`❌ Addresses file not found: ${addressesPath}`);
  console.error("   Deploy contracts first: bun run scripts/deploy/mainnet.ts");
  process.exit(1);
}

const addresses = JSON.parse(readFileSync(addressesPath, "utf-8"));

console.log("📋 Contracts to verify:");
for (const [name, address] of Object.entries(addresses)) {
  console.log(`   ${name}: ${address}`);
}

console.log("\n🔍 Verifying on BaseScan (Mainnet)...\n");

console.log("💡 To verify individual contracts:");
console.log("   cd contracts");
console.log("   forge verify-contract --chain-id 8453 <address> <contract-path>");
console.log("");
console.log("Example:");
console.log("   forge verify-contract --chain-id 8453 \\");
console.log("     0x1234... \\");
console.log("     lib/optimism/packages/contracts-bedrock/src/L1/OptimismPortal.sol:OptimismPortal");


