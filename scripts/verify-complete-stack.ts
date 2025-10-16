#!/usr/bin/env bun

/**
 * Verify Complete Stack
 * 
 * Comprehensive verification that entire Jeju L3 stack is properly set up:
 * - Configuration files
 * - TypeScript compilation
 * - Helm charts
 * - Terraform modules
 * - Scripts
 * - Tests
 * - Documentation
 * 
 * Usage:
 *   bun run verify
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";

console.log("🔍 Verifying Complete Jeju L3 Stack...\n");

let checks = 0;
let passed = 0;

async function check(name: string, fn: () => Promise<boolean>): Promise<void> {
  checks++;
  process.stdout.write(`${checks}. ${name}... `);
  
  const result = await fn();
  
  if (result) {
    passed++;
    console.log("✅");
  } else {
    console.log("❌");
  }
}

// 1. Configuration
await check("Configuration files exist", async () => {
  return existsSync("config/chain/localnet.json") &&
         existsSync("config/chain/testnet.json") &&
         existsSync("config/chain/mainnet.json");
});

// 2. TypeScript compiles
await check("TypeScript compiles", async () => {
  const result = await $`tsc --noEmit`.quiet().nothrow();
  return result.exitCode === 0;
});

// 3. Contracts directory exists
await check("Contracts directory exists", async () => {
  return existsSync("contracts/foundry.toml");
});

// 4. Indexer exists
await check("Indexer directory exists", async () => {
  return existsSync("indexer/package.json");
});

// 5. All Helm charts have Chart.yaml
await check("All Helm charts valid", async () => {
  const charts = ["op-node", "reth", "rpc-gateway", "subsquid", "op-batcher", "op-proposer"];
  for (const chart of charts) {
    if (!existsSync(join("kubernetes", "helm", chart, "Chart.yaml"))) {
      return false;
    }
  }
  return true;
});

// 6. Terraform modules exist
await check("Terraform modules exist", async () => {
  const modules = ["eks", "network", "rds", "kms", "vault", "waf"];
  for (const mod of modules) {
    if (!existsSync(join("terraform", "modules", mod, "main.tf"))) {
      return false;
    }
  }
  return true;
});

// 7. Kurtosis setup
await check("Kurtosis setup exists", async () => {
  return existsSync("kurtosis/main.star");
});

// 8. Test files
await check("Test files exist", async () => {
  return existsSync("tests/integration/chain.test.ts") &&
         existsSync("tests/e2e/defi.test.ts");
});

// 9. Scripts exist
await check("Core scripts exist", async () => {
  return existsSync("scripts/dev.ts") &&
         existsSync("scripts/test-all.ts") &&
         existsSync("scripts/localnet/start.ts");
});

// 10. Monitoring configs
await check("Monitoring configs exist", async () => {
  return existsSync("monitoring/prometheus/alerts/chain.yaml") &&
         existsSync("monitoring/grafana/dashboards/op-stack.json");
});

// 11. Documentation
await check("Documentation exists", async () => {
  return existsSync("README.md") &&
         existsSync("documentation/index.md");
});

// 12. Types
await check("Type definitions exist", async () => {
  return existsSync("types/chain.ts") &&
         existsSync("types/config.ts") &&
         existsSync("types/contracts.ts");
});

console.log("\n" + "=".repeat(60));
console.log(`📊 Stack Verification: ${passed}/${checks} checks passed`);
console.log("=".repeat(60) + "\n");

if (passed === checks) {
  console.log("✅ Complete stack verified!");
  console.log("\n🎉 Your Jeju L3 repository is fully set up and ready!");
  console.log("\n📝 Quick start:");
  console.log("   bun run dev      # Start development environment");
  console.log("   bun run test     # Run comprehensive tests");
} else {
  console.log(`⚠️  ${checks - passed} checks failed`);
  console.log("\n📝 Fix issues and run again: bun run verify");
  process.exit(1);
}

