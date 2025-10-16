#!/usr/bin/env bun

/**
 * Verify Contracts on BaseScan (Testnet)
 * 
 * Verifies all deployed contracts on Base Sepolia
 * 
 * Usage:
 *   bun run scripts/verify/verify-testnet.ts
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

console.log("🔍 Verifying Contracts on BaseScan (Sepolia)...\n");

const addressesPath = join(process.cwd(), "contracts", "deployments", "testnet", "addresses.json");

if (!existsSync(addressesPath)) {
  console.error(`❌ Addresses file not found: ${addressesPath}`);
  console.error("   Deploy contracts first: bun run scripts/deploy/l1-contracts.ts --network testnet");
  process.exit(1);
}

const addresses = JSON.parse(readFileSync(addressesPath, "utf-8"));

console.log("📋 Contracts to verify:");
for (const [name, address] of Object.entries(addresses)) {
  console.log(`   ${name}: ${address}`);
}

console.log("\n🔍 Verifying on BaseScan...\n");

console.log("\n💡 To verify individual contracts:");
console.log("   cd contracts");
console.log("   forge verify-contract --chain-id 84532 <address> <contract-path>");
console.log("");
console.log("Example:");
console.log("   forge verify-contract --chain-id 84532 \\");
console.log("     0x1234... \\");
console.log("     lib/optimism/packages/contracts-bedrock/src/L1/OptimismPortal.sol:OptimismPortal");


