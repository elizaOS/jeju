#!/usr/bin/env bun

/**
 * Development Mode
 * 
 * Starts complete local development environment:
 * - Kurtosis localnet (L1 + L2)
 * - Subsquid indexer (if --indexer flag)
 * 
 * Usage:
 *   bun run dev              # Start localnet only
 *   bun run dev --indexer    # Start localnet + indexer
 */

import { $ } from "bun";

const startIndexer = process.argv.includes("--indexer");

console.log("🚀 Starting Jeju L3 Development Environment...\n");

console.log("1️⃣  Starting Kurtosis Localnet...");
const result = await $`bun run localnet:start`.nothrow();

if (result.exitCode !== 0) {
  console.error("\n❌ Failed to start localnet");
  process.exit(1);
}

if (startIndexer) {
  console.log("\n2️⃣  Starting Subsquid Indexer...");
  console.log("   (This will run in foreground. Press Ctrl+C to stop)\n");
  
  await $`cd indexer && bun run dev`;
} else {
  console.log("\n✅ Localnet started successfully!");
  console.log("\n💡 To also start the indexer:");
  console.log("   bun run dev --indexer");
  console.log("\n   Or in a separate terminal:");
  console.log("   bun run indexer:dev");
}


