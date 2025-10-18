#!/usr/bin/env bun
/**
 * @fileoverview Complete Jeju Development Environment  
 * @module scripts/dev
 * 
 * ONE COMMAND STARTS EVERYTHING:
 * - Kurtosis Localnet (L1 + L2)
 * - Subsquid Indexer + GraphQL
 * - Node Explorer (UI + API + Collector)
 * - Documentation (VitePress)
 * - ALL Apps (Caliguland, Cloud, Hyperscape, Launchpad, OTC Agent)
 * 
 * Usage:
 *   bun run dev    # Starts everything, auto-managed lifecycle
 * 
 * Lifecycle:
 *   - Auto starts: localnet + indexer + all services + all apps
 *   - Ctrl+C: Stops everything cleanly, no orphans
 *   - No manual intervention needed
 */

import { $ } from "bun";
import { spawn, type Subprocess } from "bun";
import { existsSync } from "fs";

// Configuration
const minimal = process.argv.includes("--minimal");
const noApps = process.argv.includes("--no-apps");

const processes: Subprocess[] = [];
const services: Map<string, ServiceInfo> = new Map();

interface ServiceInfo {
  name: string;
  description: string;
  url?: string;
  port?: number;
  status: "starting" | "running" | "error" | "stopped";
  process?: Subprocess;
  category: "core" | "indexer" | "monitoring" | "docs" | "apps";
}

// Colors
const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m',
  MAGENTA: '\x1b[35m',
};

// Cleanup handler
let isShuttingDown = false;

async function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log("\n\n🛑 Shutting down all services...\n");
  
  // Kill all spawned processes
  for (const proc of processes) {
    try {
      proc.kill();
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Stop localnet
  console.log("🧹 Stopping localnet...");
  await $`bun run scripts/localnet/stop.ts`.nothrow().quiet();
  
  // Stop indexer
  console.log("🧹 Stopping indexer...");
  await $`cd indexer && npm run db:down`.nothrow().quiet();
  
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

// Handle unhandled errors
process.on("uncaughtException", async (error) => {
  console.error("\n❌ Uncaught exception:", error);
  await cleanup();
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  console.error("\n❌ Unhandled rejection:", reason);
  await cleanup();
  process.exit(1);
});

/**
 * Print header
 */
function printHeader() {
  console.clear();
  console.log(`
${COLORS.CYAN}${COLORS.BRIGHT}╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   🌴 JEJU - Complete Development Environment                      ║
║                                                                       ║
║   OP Stack on Base • EigenDA • Flashblocks • Full Stack          ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝${COLORS.RESET}

${COLORS.YELLOW}⚡ Starting all services... This may take 2-3 minutes on first run${COLORS.RESET}
`);
}

/**
 * Check if a service is responding
 */
async function healthCheck(url: string, timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      method: 'GET',
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start a service and track it
 */
function startService(
  id: string,
  info: Omit<ServiceInfo, "status">,
  command: string[],
  cwd?: string
): Subprocess {
  services.set(id, { ...info, status: "starting" });
  
  const proc = spawn({
    cmd: command,
    cwd: cwd || process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });
  
  processes.push(proc);
  services.get(id)!.process = proc;
  
  return proc;
}

/**
 * Update service status
 */
function updateServiceStatus(id: string, status: ServiceInfo["status"]) {
  const service = services.get(id);
  if (service) {
    service.status = status;
  }
}

/**
 * Print beautiful status dashboard
 */
function printDashboard() {
  console.clear();
  
  console.log(`
${COLORS.GREEN}${COLORS.BRIGHT}╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   ✅ JEJU - Ready!                                                 ║
║   Press Ctrl+C to stop (auto cleanup)                                ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝${COLORS.RESET}

${COLORS.BRIGHT}🌐 SERVICES${COLORS.RESET}
`);

  // Core services
  const coreServices = Array.from(services.entries()).filter(([, s]) => s.category === "core");
  for (const [, service] of coreServices) {
    printServiceLine(service);
  }

  console.log(`\n${COLORS.BRIGHT}📊 INDEXER & DATA${COLORS.RESET}`);
  const indexerServices = Array.from(services.entries()).filter(([, s]) => s.category === "indexer");
  for (const [, service] of indexerServices) {
    printServiceLine(service);
  }

  if (!minimal) {
    console.log(`\n${COLORS.BRIGHT}📈 MONITORING${COLORS.RESET}`);
    const monitoringServices = Array.from(services.entries()).filter(([, s]) => s.category === "monitoring");
    for (const [, service] of monitoringServices) {
      printServiceLine(service);
    }

    console.log(`\n${COLORS.BRIGHT}📚 DOCUMENTATION${COLORS.RESET}`);
    const docsServices = Array.from(services.entries()).filter(([, s]) => s.category === "docs");
    for (const [, service] of docsServices) {
      printServiceLine(service);
    }

    if (!noApps) {
      console.log(`\n${COLORS.BRIGHT}🎮 APPS & GAMES${COLORS.RESET}`);
      const appServices = Array.from(services.entries()).filter(([, s]) => s.category === "apps");
      for (const [, service] of appServices) {
        printServiceLine(service);
      }
    }
  }

  console.log(`
${COLORS.CYAN}${COLORS.BRIGHT}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}

${COLORS.YELLOW}💡 Quick Actions:${COLORS.RESET}
  • Run tests:      bun run test
  • Deploy:         bun run deploy:testnet
  • Stop services:  Ctrl+C (auto cleanup)

${COLORS.GREEN}✨ All systems running! Happy developing!${COLORS.RESET}
`);
}

/**
 * Print a single service line
 */
function printServiceLine(service: ServiceInfo) {
  const statusIcon = service.status === "running" ? "✅" : 
                     service.status === "starting" ? "🔄" :
                     service.status === "error" ? "❌" : "⏸️";
  
  const statusColor = service.status === "running" ? COLORS.GREEN : 
                      service.status === "starting" ? COLORS.YELLOW :
                      service.status === "error" ? COLORS.RED : COLORS.RESET;

  const nameWidth = 30;
  const name = service.name.padEnd(nameWidth);
  
  if (service.url) {
    const url = service.url.padEnd(40);
    console.log(`  ${statusIcon} ${COLORS.BRIGHT}${name}${COLORS.RESET} ${COLORS.CYAN}${url}${COLORS.RESET}`);
  } else {
    console.log(`  ${statusIcon} ${COLORS.BRIGHT}${name}${COLORS.RESET} ${statusColor}${service.status}${COLORS.RESET}`);
  }
}

/**
 * Wait for service to be healthy
 */
async function waitForService(id: string, url: string, maxWait = 60000) {
  const startTime = Date.now();
  const interval = 2000;
  
  while (Date.now() - startTime < maxWait) {
    if (await healthCheck(url, 3000)) {
      updateServiceStatus(id, "running");
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  updateServiceStatus(id, "error");
  return false;
}

/**
 * Main dev environment startup
 */
async function main() {
  printHeader();

  try {
    // ============================================================
    // PHASE 1: Kurtosis Localnet
    // ============================================================
    console.log(`\n${COLORS.CYAN}━━━ Phase 1: Starting Kurtosis Localnet ━━━${COLORS.RESET}\n`);
    
    services.set("localnet", {
      name: "Kurtosis Localnet (L1 + L2)",
      description: "Local blockchain network",
      status: "starting",
      category: "core",
    });

    await $`bun run scripts/localnet/start.ts`.quiet();
    
    // Get RPC ports
    const l1Port = await $`kurtosis port print jeju-localnet geth-l1 rpc`.text();
    const l2Port = await $`kurtosis port print jeju-localnet op-geth rpc`.text();
    
    const l1RpcPort = l1Port.trim().split(":")[1];
    const l2RpcPort = l2Port.trim().split(":")[1];
    
    updateServiceStatus("localnet", "running");
    
    services.set("l1-rpc", {
      name: "L1 RPC (Geth)",
      description: "Base Layer 1 RPC",
      url: `http://localhost:${l1RpcPort}`,
      port: parseInt(l1RpcPort),
      status: "running",
      category: "core",
    });
    
    services.set("l2-rpc", {
      name: "L2 RPC (OP-Geth)",
      description: "Jeju Layer 2 RPC",
      url: `http://localhost:${l2RpcPort}`,
      port: parseInt(l2RpcPort),
      status: "running",
      category: "core",
    });
    
    services.set("kurtosis-ui", {
      name: "Kurtosis Dashboard",
      description: "Manage localnet",
      url: "http://localhost:9711",
      port: 9711,
      status: "running",
      category: "core",
    });

    console.log(`${COLORS.GREEN}✅ Localnet started${COLORS.RESET}`);

    if (minimal) {
      printDashboard();
      console.log(`\n${COLORS.YELLOW}Running in minimal mode - only localnet started${COLORS.RESET}\n`);
      return;
    }

    // ============================================================
    // PHASE 2: Subsquid Indexer
    // ============================================================
    console.log(`\n${COLORS.CYAN}━━━ Phase 2: Starting Subsquid Indexer ━━━${COLORS.RESET}\n`);
    
    services.set("indexer", {
      name: "Subsquid Indexer",
      description: "Blockchain indexer",
      status: "starting",
      category: "indexer",
    });

    // Build indexer first
    console.log(`${COLORS.CYAN}📦 Building indexer...${COLORS.RESET}`);
    await $`cd indexer && npm run build`.quiet();
    console.log(`${COLORS.GREEN}✅ Indexer built${COLORS.RESET}`);

    // Start indexer process (this runs predev which sets up DB, then starts processor and GraphQL)
    // Pass the L2 RPC URL to the indexer
    const l2RpcUrl = `http://localhost:${l2RpcPort}`;
    console.log(`${COLORS.CYAN}🔗 Connecting indexer to L2 RPC: ${l2RpcUrl}${COLORS.RESET}`);
    
    const indexerProc = spawn({
      cmd: ["npm", "run", "dev"],
      cwd: process.cwd() + "/indexer",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        RPC_ETH_HTTP: l2RpcUrl,
        START_BLOCK: "0",
        CHAIN_ID: "8004", // Jeju L2 chain ID
        DB_NAME: "indexer",
        DB_PORT: "23798",
        GQL_PORT: "4350",
      },
    });
    
    processes.push(indexerProc);
    services.set("indexer-process", {
      name: "Indexer Process",
      description: "",
      status: "starting",
      category: "indexer",
      process: indexerProc,
    });

    // Stream indexer output for debugging
    (async () => {
      if (indexerProc.stdout) {
        for await (const chunk of indexerProc.stdout) {
          const text = new TextDecoder().decode(chunk);
          if (text.includes("error") || text.includes("Error") || text.includes("failed")) {
            console.log(`${COLORS.RED}[Indexer]${COLORS.RESET} ${text.trim()}`);
          }
        }
      }
    })();

    (async () => {
      if (indexerProc.stderr) {
        for await (const chunk of indexerProc.stderr) {
          const text = new TextDecoder().decode(chunk);
          console.log(`${COLORS.YELLOW}[Indexer Error]${COLORS.RESET} ${text.trim()}`);
        }
      }
    })();

    // Add GraphQL service
    services.set("indexer-graphql", {
      name: "GraphQL API",
      description: "Query blockchain data",
      url: "http://localhost:4350/graphql",
      port: 4350,
      status: "starting",
      category: "indexer",
    });

    console.log(`${COLORS.YELLOW}⏳ Waiting for database setup and indexer to start (this may take 30-60 seconds)...${COLORS.RESET}`);
    
    // Wait for DB setup and services to start (increased from 5s to 15s)
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Check if GraphQL is ready
    let graphqlReady = false;
    for (let i = 0; i < 20; i++) {
      if (await healthCheck("http://localhost:4350/graphql", 2000)) {
        updateServiceStatus("indexer-graphql", "running");
        updateServiceStatus("indexer-process", "running");
        graphqlReady = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (graphqlReady) {
      console.log(`${COLORS.GREEN}✅ Indexer started successfully${COLORS.RESET}`);
    } else {
      console.log(`${COLORS.YELLOW}⚠️  Indexer may still be starting... Check http://localhost:4350/graphql${COLORS.RESET}`);
    }

    // ============================================================
    // PHASE 3: Node Explorer
    // ============================================================
    console.log(`\n${COLORS.CYAN}━━━ Phase 3: Starting Node Explorer ━━━${COLORS.RESET}\n`);

    if (existsSync("node-explorer")) {
      startService(
        "explorer-api",
        {
          name: "Node Explorer API",
          description: "Node data API",
          url: "http://localhost:4002",
          port: 4002,
          category: "monitoring",
        },
        ["bun", "run", "src/api/server.ts"],
        "node-explorer"
      );

      startService(
        "explorer-collector",
        {
          name: "Node Collector",
          description: "Collect node metrics",
          category: "monitoring",
        },
        ["bun", "run", "src/collector/node-collector.ts"],
        "node-explorer"
      );

      startService(
        "explorer-ui",
        {
          name: "Node Explorer UI",
          description: "Monitor nodes",
          url: "http://localhost:3011",
          port: 3011,
          category: "monitoring",
        },
        ["bun", "run", "dev"],
        "node-explorer"
      );

      console.log(`${COLORS.GREEN}✅ Node Explorer starting${COLORS.RESET}`);
    }

    // ============================================================
    // PHASE 4: Documentation
    // ============================================================
    console.log(`\n${COLORS.CYAN}━━━ Phase 4: Starting Documentation ━━━${COLORS.RESET}\n`);

    if (existsSync("documentation")) {
      startService(
        "docs",
        {
          name: "Documentation (VitePress)",
          description: "Full documentation",
          url: "http://localhost:5174",
          port: 5174,
          category: "docs",
        },
        ["bun", "run", "dev"],
        "documentation"
      );

      console.log(`${COLORS.GREEN}✅ Documentation starting${COLORS.RESET}`);
    }

    // ============================================================
    // PHASE 5: Monitoring
    // ============================================================
    console.log(`\n${COLORS.CYAN}━━━ Phase 5: Starting Monitoring ━━━${COLORS.RESET}\n`);

    if (existsSync("monitoring/docker-compose.yml")) {
      console.log(`${COLORS.CYAN}🚀 Starting Prometheus and Grafana...${COLORS.RESET}`);
      
      // Stop any existing monitoring containers
      await $`cd monitoring && docker-compose down`.quiet().nothrow();
      
      // Start monitoring stack
      const monitoringResult = await $`cd monitoring && docker-compose up -d`.nothrow();
      
      if (monitoringResult.exitCode === 0) {
        services.set("prometheus", {
          name: "Prometheus",
          description: "Metrics database",
          url: "http://localhost:9090",
          port: 9090,
          status: "running",
          category: "monitoring",
        });

        services.set("grafana", {
          name: "Grafana",
          description: "Metrics dashboards",
          url: "http://localhost:3010",
          port: 3010,
          status: "running",
          category: "monitoring",
        });

        console.log(`${COLORS.GREEN}✅ Prometheus running on http://localhost:9090${COLORS.RESET}`);
        console.log(`${COLORS.GREEN}✅ Grafana running on http://localhost:3010 (admin/admin)${COLORS.RESET}`);
      } else {
        console.log(`${COLORS.YELLOW}⚠️  Failed to start monitoring stack${COLORS.RESET}`);
        console.log(`${COLORS.YELLOW}   Try: cd monitoring && docker-compose up -d${COLORS.RESET}`);
      }
    } else {
      console.log(`${COLORS.YELLOW}⚠️  Monitoring docker-compose not found${COLORS.RESET}`);
    }

    // ============================================================
    // PHASE 6: Apps
    // ============================================================
    if (!noApps) {
      console.log(`\n${COLORS.CYAN}━━━ Phase 6: Starting Apps ━━━${COLORS.RESET}\n`);

      // Caliguland (auto-start if package.json exists)
      if (existsSync("apps/caliguland/package.json")) {
        console.log(`${COLORS.CYAN}🎮 Starting Caliguland...${COLORS.RESET}`);
        
        startService(
          "caliguland-game",
          {
            name: "Caliguland Game",
            description: "Prediction game with AI agents",
            url: "http://localhost:8000",
            port: 8000,
            category: "apps",
          },
          ["npm", "run", "dev"],
          "apps/caliguland"
        );
        
        console.log(`${COLORS.GREEN}✅ Caliguland starting${COLORS.RESET}`);
      } else if (existsSync("apps/caliguland")) {
        console.log(`${COLORS.YELLOW}ℹ️  Caliguland: cd apps/caliguland && make start (no package.json found)${COLORS.RESET}`);
      }

      // Hyperscape (On-Chain Game)
      if (existsSync("apps/hyperscape")) {
        console.log(`${COLORS.CYAN}📦 Deploying Hyperscape MUD contracts to localnet...${COLORS.RESET}`);
        
        // Deploy Hyperscape contracts
        // Note: API keys and PRIVATE_KEY not needed for local development (uses Kurtosis test accounts)
        if (!process.env.BASESCAN_API_KEY || !process.env.ETHERSCAN_API_KEY) {
          console.log(`${COLORS.YELLOW}⚠️  BASESCAN_API_KEY/ETHERSCAN_API_KEY not set (only needed for mainnet contract verification)${COLORS.RESET}`);
        }
        
        try {
          await $`cd contracts && forge script script/DeployHyperscape.s.sol --rpc-url http://localhost:${l2RpcPort} --broadcast --legacy`.env({
            ...process.env,
            BASESCAN_API_KEY: process.env.BASESCAN_API_KEY || "not-needed-for-local-dev",
            ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || "not-needed-for-local-dev",
            PRIVATE_KEY: process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
          }).nothrow();
          console.log(`${COLORS.GREEN}✅ Hyperscape contracts deployed${COLORS.RESET}`);
        } catch (e) {
          console.log(`${COLORS.YELLOW}⚠️  Hyperscape contract deployment skipped (will use existing)${COLORS.RESET}`);
        }
        
        // Start Hyperscape server
        startService(
          "hyperscape-server",
          {
            name: "Hyperscape Server",
            description: "On-chain game server",
            url: "http://localhost:5555",
            port: 5555,
            category: "apps",
          },
          ["bun", "run", "dev"],
          "apps/hyperscape/packages/server"
        );
        
        // Start Hyperscape client
        startService(
          "hyperscape-client",
          {
            name: "Hyperscape Client",
            description: "3D On-Chain RPG",
            url: "http://localhost:3333",
            port: 3333,
            category: "apps",
          },
          ["bun", "run", "dev"],
          "apps/hyperscape/packages/client"
        );
        
        console.log(`${COLORS.GREEN}✅ Hyperscape starting (on-chain game)${COLORS.RESET}`);
      }

      // Cloud (auto-start)
      if (existsSync("apps/cloud/package.json")) {
        console.log(`${COLORS.CYAN}☁️  Starting Eliza Cloud...${COLORS.RESET}`);
        
        startService(
          "cloud-frontend",
          {
            name: "Eliza Cloud Frontend",
            description: "AI agent platform UI",
            url: "http://localhost:3005",
            port: 3005,
            category: "apps",
          },
          ["npm", "run", "dev"],
          "apps/cloud"
        );
        
        console.log(`${COLORS.GREEN}✅ Eliza Cloud starting${COLORS.RESET}`);
      } else if (existsSync("apps/cloud")) {
        console.log(`${COLORS.YELLOW}ℹ️  Cloud: No package.json found (may need manual setup)${COLORS.RESET}`);
      }

      // Launchpad (auto-start backend and frontend)
      if (existsSync("apps/launchpad")) {
        console.log(`${COLORS.CYAN}🚀 Starting Launchpad backend...${COLORS.RESET}`);
        
        // Start launchpad backend
        startService(
          "launchpad-backend",
          {
            name: "Launchpad Backend API",
            description: "Token launchpad API",
            url: "http://localhost:3331",
            port: 3331,
            category: "apps",
          },
          ["pnpm", "run", "dev"],
          "apps/launchpad/apps/backend"
        );
        
        // Start launchpad frontend
        startService(
          "launchpad-frontend",
          {
            name: "Launchpad Frontend",
            description: "Multi-chain token launchpad",
            url: "http://localhost:3330",
            port: 3330,
            category: "apps",
          },
          ["pnpm", "run", "dev"],
          "apps/launchpad/apps/frontend"
        );
        
        console.log(`${COLORS.GREEN}✅ Launchpad starting (backend + frontend)${COLORS.RESET}`);
      }

      // OTC Agent (auto-start on Jeju Localnet)
      if (existsSync("apps/otc-agent")) {
        console.log(`${COLORS.CYAN}🤖 Starting OTC Agent on Jeju Localnet...${COLORS.RESET}`);
        
        startService(
          "otc-agent",
          {
            name: "OTC Agent (Eliza)",
            description: "AI-powered OTC desk",
            url: "http://localhost:2222",
            port: 2222,
            category: "apps",
          },
          ["npm", "run", "dev"],
          "apps/otc-agent"
        );
        
        console.log(`${COLORS.GREEN}✅ OTC Agent starting on http://localhost:2222${COLORS.RESET}`);
      }
    }

    // ============================================================
    // Final Status
    // ============================================================
    console.log(`\n${COLORS.CYAN}━━━ Waiting for services to be ready... ━━━${COLORS.RESET}\n`);
    
    // Give services time to start
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Health check services
    if (services.has("explorer-ui")) {
      await waitForService("explorer-ui", "http://localhost:3011");
    }
    
    if (services.has("explorer-api")) {
      await waitForService("explorer-api", "http://localhost:4002/health");
    }

    if (services.has("prometheus")) {
      await waitForService("prometheus", "http://localhost:9090/-/healthy");
    }

    if (services.has("grafana")) {
      await waitForService("grafana", "http://localhost:3010");
    }

    if (services.has("docs")) {
      await waitForService("docs", "http://localhost:5174");
    }

    // Print final dashboard
    printDashboard();

    // Keep running
    await new Promise(() => {});
    
  } catch (error: any) {
    console.error(`\n${COLORS.RED}❌ Error starting development environment:${COLORS.RESET}`, error);
    console.error(`\n${COLORS.YELLOW}💡 Troubleshooting:${COLORS.RESET}`);
    console.error(`   • Reset localnet: kurtosis enclave rm -f jeju-localnet`);
    console.error(`   • Clean build: bun run clean`);
    console.error(`   • Check ports: lsof -i :8545`);
    process.exit(1);
  }
}

// Run
main();
