#!/usr/bin/env bun
/**
 * Production Start Script
 * 
 * Starts the complete Jeju production stack:
 * - Indexer (Subsquid GraphQL)
 * - Node Explorer (UI + API + Collector)
 * - Oracle price feeds
 * - Node rewards monitoring
 * - Heartbeat/monitoring
 * 
 * Usage:
 *   bun run start            # Production mode
 *   NODE_ENV=production bun run start
 */

import { spawn, type Subprocess } from "bun";

const processes: Subprocess[] = [];
const services: { name: string; process: Subprocess; port?: number }[] = [];

// Cleanup handler
let isShuttingDown = false;

async function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log("\n\n🛑 Shutting down all services...\n");
  
  for (const proc of processes) {
    try {
      proc.kill();
    } catch (e) {
      // Ignore errors
    }
  }
  
  console.log("\n✅ All services stopped\n");
}

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(0);
});

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌴 JEJU PRODUCTION START                             ║
║   Starting all production services                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Step 1: Start Indexer
console.log("1️⃣  Starting Subsquid Indexer...");
console.log("   🔄 Setting up database and starting GraphQL server...");
console.log("   ⏳ This may take 10-15 seconds...");
const indexerProc = spawn(["npm", "run", "dev"], {
  cwd: "/Users/shawwalters/jeju/indexer",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "development" },
});
processes.push(indexerProc);
services.push({ 
  name: "Indexer (GraphQL)", 
  process: indexerProc,
  port: 4350 
});

await new Promise(resolve => setTimeout(resolve, 8000));
console.log("   ✅ Indexer started (GraphQL API should be available soon)\n");

// Step 2: Start Node Explorer API
console.log("2️⃣  Starting Node Explorer API...");
const explorerAPIProc = spawn(["bun", "run", "src/api/server.ts"], {
  cwd: "/Users/shawwalters/jeju/node-explorer",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, PORT: "4002" },
});
processes.push(explorerAPIProc);
services.push({ 
  name: "Explorer API", 
  process: explorerAPIProc,
  port: 4002 
});

await new Promise(resolve => setTimeout(resolve, 2000));
console.log("   ✅ Started\n");

// Step 3: Start Node Explorer UI
console.log("3️⃣  Starting Node Explorer UI...");
const explorerUIProc = spawn(["bun", "run", "dev"], {
  cwd: "/Users/shawwalters/jeju/node-explorer",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, PORT: "3011" },
});
processes.push(explorerUIProc);
services.push({ 
  name: "Explorer UI", 
  process: explorerUIProc,
  port: 3011 
});

await new Promise(resolve => setTimeout(resolve, 2000));
console.log("   ✅ Started\n");

// Step 4: Start Node Collector
console.log("4️⃣  Starting Node Data Collector...");
const collectorProc = spawn(["bun", "run", "src/collector/node-collector.ts"], {
  cwd: "/Users/shawwalters/jeju/node-explorer",
  stdout: "inherit",
  stderr: "inherit",
});
processes.push(collectorProc);
services.push({ 
  name: "Node Collector", 
  process: collectorProc 
});

await new Promise(resolve => setTimeout(resolve, 1000));
console.log("   ✅ Started\n");

// Step 5: Start Oracle
console.log("5️⃣  Starting Oracle Price Feeds...");
const oracleProc = spawn(["bun", "run", "scripts/oracle-updater.ts"], {
  cwd: "/Users/shawwalters/jeju",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, BASE_RPC_URL: "https://mainnet.base.org" },
});
processes.push(oracleProc);
services.push({ 
  name: "Oracle Price Feeds", 
  process: oracleProc 
});

await new Promise(resolve => setTimeout(resolve, 1000));
console.log("   ✅ Started\n");

// Step 6: Start Rewards Oracle
console.log("6️⃣  Starting Node Rewards Oracle...");
const rewardsProc = spawn(["bun", "run", "scripts/rewards/rewards-oracle.ts"], {
  cwd: "/Users/shawwalters/jeju",
  stdout: "inherit",
  stderr: "inherit",
});
processes.push(rewardsProc);
services.push({ 
  name: "Rewards Oracle", 
  process: rewardsProc 
});

await new Promise(resolve => setTimeout(resolve, 1000));
console.log("   ✅ Started\n");

// Step 7: Start Heartbeat Monitor
console.log("7️⃣  Starting Heartbeat Monitor...");
const heartbeatProc = spawn(["bun", "run", "scripts/monitoring/heartbeat.ts"], {
  cwd: "/Users/shawwalters/jeju",
  stdout: "inherit",
  stderr: "inherit",
});
processes.push(heartbeatProc);
services.push({ 
  name: "Heartbeat Monitor", 
  process: heartbeatProc 
});

await new Promise(resolve => setTimeout(resolve, 1000));
console.log("   ✅ Started\n");

// Step 8: Start Documentation
console.log("8️⃣  Starting Documentation (VitePress)...");
const docsProc = spawn(["bun", "run", "dev"], {
  cwd: "/Users/shawwalters/jeju/documentation",
  stdout: "inherit",
  stderr: "inherit",
});
processes.push(docsProc);
services.push({ 
  name: "Documentation", 
  process: docsProc,
  port: 5174
});

await new Promise(resolve => setTimeout(resolve, 2000));
console.log("   ✅ Started\n");

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log("✅ All services started\n");

console.log("🌐 Endpoints:");
console.log("   Explorer:  http://localhost:3011");
console.log("   API:       http://localhost:4002");
console.log("   GraphQL:   http://localhost:4350/graphql");
console.log("\n💡 Press Ctrl+C to stop\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Keep process alive and monitor services
while (true) {
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check if any process died
  let anyDied = false;
  for (const service of services) {
    if (service.process.killed) {
      console.log(`⚠️  ${service.name} stopped unexpectedly`);
      anyDied = true;
    }
  }
  
  if (anyDied) {
    console.log("\n⚠️  Some services have stopped. Restarting recommended.\n");
  }
}

