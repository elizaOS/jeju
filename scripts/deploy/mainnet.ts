#!/usr/bin/env bun

/**
 * Deploy to Mainnet
 * 
 * Complete mainnet deployment workflow
 * 
 * Usage:
 *   bun run scripts/deploy/mainnet.ts
 */

import { $ } from "bun";

console.log("🚀 Jeju Mainnet Deployment\n");

console.log("⚠️  MAINNET DEPLOYMENT CHECKLIST:\n");

const checklist = [
  "[ ] Testnet running stable for 4+ weeks",
  "[ ] Security audit complete",
  "[ ] Bug bounty program active",
  "[ ] Legal entity established",
  "[ ] Insurance obtained",
  "[ ] On-call team ready (24/7)",
  "[ ] Disaster recovery plan documented",
  "[ ] Keys in hardware wallets / KMS",
  "[ ] Multisig wallets configured",
  "[ ] Sufficient ETH on Base ($60k+)",
  "[ ] Monitoring fully deployed",
  "[ ] Load testing complete"
];

for (const item of checklist) {
  console.log(`  ${item}`);
}

console.log("\n❌ DO NOT PROCEED unless all items checked!\n");

const confirm = prompt("Type 'DEPLOY TO MAINNET' to continue: ");

if (confirm !== "DEPLOY TO MAINNET") {
  console.log("\n⚠️  Deployment cancelled");
  process.exit(0);
}

console.log("\n🚀 Starting mainnet deployment...\n");
console.log("Step 1: Deploy L1 contracts to Base Mainnet");

const result = await $`bun run scripts/deploy/l1-contracts.ts --network mainnet`.nothrow();

if (result.exitCode !== 0) {
  console.error("\n❌ Mainnet deployment failed!");
  process.exit(1);
}

console.log("\n✅ Mainnet L1 contracts deployed!");
console.log("\n📝 Next steps:");
console.log("   1. Generate genesis: bun run scripts/deploy/l2-genesis.ts --network mainnet");
console.log("   2. Update packages/config/chain/mainnet.json");
console.log("   3. Deploy infrastructure: bun run k8s:mainnet");
console.log("   4. Monitor closely for 48 hours");


