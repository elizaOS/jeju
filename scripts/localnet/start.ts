#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const KURTOSIS_PACKAGE = "./kurtosis";  // Local package, not GitHub
const ENCLAVE_NAME = "jeju-localnet";
const OUTPUT_DIR = join(process.cwd(), ".kurtosis");

async function main() {
  console.log("🚀 Starting Jeju Localnet...");
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Check if Kurtosis is installed
  const kurtosisInstalled = await checkKurtosis();
  if (!kurtosisInstalled) {
    console.error("❌ Kurtosis is not installed. Please install it first:");
    console.error("   brew install kurtosis-tech/tap/kurtosis");
    process.exit(1);
  }

  // Check if Docker is running
  const dockerRunning = await checkDocker();
  if (!dockerRunning) {
    console.error("❌ Docker is not running. Please start Docker Desktop.");
    process.exit(1);
  }

  // Clean up existing enclave if it exists
  console.log("🧹 Cleaning up existing enclave...");
  await $`kurtosis enclave rm -f ${ENCLAVE_NAME}`.quiet().nothrow();

  // Start the localnet
  console.log("📦 Deploying Jeju stack with Kurtosis...");
  console.log("   This may take 5-10 minutes on first run...");
  console.log("   - Deploying L1 Ethereum (Geth dev mode)");
  console.log("   - Deploying L2 Execution Layer (op-geth dev mode)");
  console.log("");
  
  const result = await $`kurtosis run ${KURTOSIS_PACKAGE} --enclave ${ENCLAVE_NAME}`.nothrow();
  
  if (result.exitCode !== 0) {
    console.error("❌ Failed to start localnet");
    process.exit(1);
  }

  // Get enclave info
  console.log("\n📊 Fetching deployment info...");
  const info = await $`kurtosis enclave inspect ${ENCLAVE_NAME}`.text();
  
  // Get actual port numbers
  const l1RpcPort = await $`kurtosis port print ${ENCLAVE_NAME} geth-l1 rpc`.text();
  const l2RpcPort = await $`kurtosis port print ${ENCLAVE_NAME} op-geth rpc`.text();
  
  const l1Port = l1RpcPort.trim().split(":")[1];
  const l2Port = l2RpcPort.trim().split(":")[1];
  
  // Extract and display key endpoints
  console.log("\n✅ Jeju Localnet is running!");
  console.log("\n📌 Key Endpoints:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   L1 RPC: http://127.0.0.1:${l1Port}`);
  console.log(`   L2 RPC: http://127.0.0.1:${l2Port}`);
  console.log("\n🔧 Chain Info:");
  console.log("   L1 Chain ID: 1337");
  console.log("   L2 Chain ID: 1337 (dev mode)");
  console.log("   Block Time:  2 seconds");
  console.log("\n💰 Pre-funded Dev Account:");
  console.log("   Address: 0x71562b71999873DB5b286dF957af199Ec94617F7");
  console.log("   Key:     0xb71c71a67e1177ad4e901695e1b4b9ee17ae16c6668d313eac2f96dbcda3f291");
  console.log("   Balance: 10^49 ETH (effectively unlimited)");
  console.log("\n🧪 Test it:");
  console.log(`   cast block latest --rpc-url http://127.0.0.1:${l2Port}`);
  console.log(`   cast send 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --value 0.1ether --rpc-url http://127.0.0.1:${l2Port} --private-key 0xb71c71a67e1177ad4e901695e1b4b9ee17ae16c6668d313eac2f96dbcda3f291`);
  console.log("\n💡 Useful Commands:");
  console.log("   kurtosis enclave inspect jeju-localnet      - View all services");
  console.log("   kurtosis service logs jeju-localnet op-geth - View L2 logs");
  console.log("   bun run dev                                 - Full dev environment (manages lifecycle)");
  console.log("   kurtosis enclave rm jeju-localnet           - Reset localnet");
  console.log("\n📚 Documentation: README.md");
  
  // Save deployment info
  const deploymentInfo = {
    enclaveName: ENCLAVE_NAME,
    timestamp: new Date().toISOString(),
    endpoints: extractEndpoints(info)
  };
  
  await Bun.write(
    join(OUTPUT_DIR, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`\n💾 Deployment info saved to: ${join(OUTPUT_DIR, "deployment.json")}`);
}

async function checkKurtosis(): Promise<boolean> {
  const result = await $`which kurtosis`.quiet().nothrow();
  return result.exitCode === 0;
}

async function checkDocker(): Promise<boolean> {
  const result = await $`docker ps`.quiet().nothrow();
  return result.exitCode === 0;
}

function extractEndpoints(info: string): Record<string, string> {
  const endpoints: Record<string, string> = {};
  
  const patterns = {
    l1Rpc: /l1.*rpc.*http:\/\/[^:]+:(\d+)/,
    l2Rpc: /l2.*rpc.*http:\/\/[^:]+:(\d+)/,
    l2Ws: /l2.*ws.*ws:\/\/[^:]+:(\d+)/
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = info.match(pattern);
    if (match) {
      endpoints[key] = `http://127.0.0.1:${match[1]}`;
    }
  }
  
  return endpoints;
}

main();

