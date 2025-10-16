#!/usr/bin/env bun

/**
 * Start Testnet
 * 
 * Deploys and starts complete testnet infrastructure:
 * 1. Validates configuration
 * 2. Deploys Terraform infrastructure (AWS)
 * 3. Deploys Kubernetes services (Helmfile)
 * 4. Verifies deployment
 * 
 * Prerequisites:
 * - AWS credentials configured
 * - kubectl configured
 * - helm and helmfile installed
 * - Contracts deployed to Base Sepolia
 * 
 * Usage:
 *   bun run start
 */

import { $ } from "bun";

console.log("🚀 Starting Jeju L3 Testnet Deployment...\n");

// Step 1: Validate configuration
console.log("1️⃣  Validating configuration...");
const validateResult = await $`bun run config:validate`.nothrow();

if (validateResult.exitCode !== 0) {
  console.error("\n❌ Configuration validation failed!");
  console.error("   Fix configuration issues before deploying.");
  process.exit(1);
}

console.log("   ✅ Configuration valid\n");

// Step 2: Check prerequisites
console.log("2️⃣  Checking prerequisites...");

const awsCheck = await $`aws sts get-caller-identity`.quiet().nothrow();
if (awsCheck.exitCode !== 0) {
  console.error("   ❌ AWS credentials not configured");
  console.error("   Run: aws configure");
  process.exit(1);
}
console.log("   ✅ AWS credentials configured");

const kubectlCheck = await $`kubectl version --client`.quiet().nothrow();
if (kubectlCheck.exitCode !== 0) {
  console.error("   ❌ kubectl not installed");
  process.exit(1);
}
console.log("   ✅ kubectl installed");

const helmCheck = await $`helm version`.quiet().nothrow();
if (helmCheck.exitCode !== 0) {
  console.error("   ❌ helm not installed");
  process.exit(1);
}
console.log("   ✅ helm installed");

const helmfileCheck = await $`helmfile --version`.quiet().nothrow();
if (helmfileCheck.exitCode !== 0) {
  console.error("   ❌ helmfile not installed");
  console.error("   Install: brew install helmfile");
  process.exit(1);
}
console.log("   ✅ helmfile installed\n");

// Step 3: Deploy Terraform infrastructure
console.log("3️⃣  Deploying Terraform infrastructure...");
console.log("   This will take 15-30 minutes on first run...\n");

const confirmTerraform = prompt("   Deploy AWS infrastructure? (yes/no): ");
if (confirmTerraform?.toLowerCase() !== "yes") {
  console.log("\n⚠️  Skipping Terraform deployment");
} else {
  const terraformResult = await $`cd terraform/environments/testnet && terraform init && terraform apply -auto-approve`.nothrow();
  
  if (terraformResult.exitCode !== 0) {
    console.error("\n❌ Terraform deployment failed!");
    process.exit(1);
  }
  
  console.log("   ✅ Infrastructure deployed\n");
}

// Step 4: Configure kubectl
console.log("4️⃣  Configuring kubectl...");
await $`aws eks update-kubeconfig --region us-east-1 --name jeju-testnet`;
console.log("   ✅ kubectl configured\n");

// Step 5: Deploy Kubernetes services
console.log("5️⃣  Deploying Kubernetes services with Helmfile...");
console.log("   This will take 10-20 minutes...\n");

const helmfileResult = await $`bun run k8s:testnet`.nothrow();

if (helmfileResult.exitCode !== 0) {
  console.error("\n❌ Helmfile deployment failed!");
  process.exit(1);
}

console.log("\n✅ Kubernetes services deployed\n");

// Step 6: Verify deployment
console.log("6️⃣  Verifying deployment...");

await $`sleep 30`; // Wait for pods to start

const podsResult = await $`kubectl get pods -A`.nothrow();
console.log(podsResult.stdout.toString());

// Step 7: Get endpoints
console.log("\n7️⃣  Getting service endpoints...\n");

console.log("📌 Testnet Endpoints:");
console.log("   RPC:     https://testnet-rpc.jeju.network");
console.log("   WS:      wss://testnet-ws.jeju.network");
console.log("   Indexer: https://testnet-indexer.jeju.network/graphql");
console.log("   Docs:    https://docs.jeju.network");

console.log("\n✅ Testnet deployment complete!");
console.log("\n📝 Next steps:");
console.log("   1. Test RPC: cast block latest --rpc-url https://testnet-rpc.jeju.network");
console.log("   2. Monitor: kubectl get pods -n rpc");
console.log("   3. View logs: kubectl logs -f -n rpc -l app.kubernetes.io/name=rpc-gateway");


