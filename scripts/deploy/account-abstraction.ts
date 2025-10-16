#!/usr/bin/env bun

/**
 * Deploy ERC-4337 Account Abstraction
 * 
 * Deploys EntryPoint, Account Factory, and Paymaster to L2
 * 
 * Usage:
 *   bun run scripts/deploy/account-abstraction.ts --network testnet
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
const rpcUrl = network === "mainnet" 
  ? process.env.JEJU_MAINNET_RPC_URL || "https://rpc.jeju.network"
  : process.env.JEJU_TESTNET_RPC_URL || "https://testnet-rpc.jeju.network";

console.log(`🚀 Deploying ERC-4337 to Jeju ${network}...\n`);
console.log(`RPC: ${rpcUrl}\n`);

const result = await $`cd contracts && forge script script/DeployAA.s.sol:DeployAA --rpc-url ${rpcUrl} --broadcast`.nothrow();

if (result.exitCode !== 0) {
  console.error("\n❌ Deployment failed!");
  process.exit(1);
}

console.log("\n✅ ERC-4337 deployed successfully!");
console.log("\n📝 EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789 (canonical)");
console.log("   Save other addresses to deployments/aa.json");


