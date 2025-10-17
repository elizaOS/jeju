#!/usr/bin/env bun
import { $ } from "bun";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { getChainConfig } from "../../config";

async function main() {
  const network = "mainnet";
  console.log(`🔍 Verifying contracts on ${network}...`);
  console.log("⚠️  WARNING: Mainnet verification");
  console.log("=".repeat(60));

  const config = getChainConfig(network);
  const contractsDir = resolve(process.cwd(), "contracts");
  
  if (!process.env.BASESCAN_API_KEY) {
    console.error("❌ BASESCAN_API_KEY environment variable required");
    process.exit(1);
  }
  
  // Read deployment files
  const deploymentFiles = [
    "deployments/mainnet/liquidity-system.json",
    "deployments/mainnet/rewards.json",
  ];
  
  let verified = 0;
  let failed = 0;
  
  for (const file of deploymentFiles) {
    const filePath = resolve(contractsDir, file);
    
    if (!existsSync(filePath)) {
      console.log(`⚠️  Deployment file not found: ${file}`);
      continue;
    }
    
    console.log(`\n📋 Verifying contracts from ${file}...`);
    
    try {
      const deployment = JSON.parse(readFileSync(filePath, 'utf-8'));
      
      // Verify each contract
      for (const [name, address] of Object.entries(deployment)) {
        if (typeof address !== 'string' || !address.startsWith('0x')) continue;
        if (name === 'chainId' || name === 'timestamp') continue;
        
        console.log(`\n  Verifying ${name} at ${address}...`);
        
        try {
          const contractPath = getContractPath(name);
          
          if (!contractPath) {
            console.log(`  ⚠️  Unknown contract type: ${name}`);
            continue;
          }
          
          const result = await $`cd ${contractsDir} && forge verify-contract ${address} ${contractPath} --chain-id ${config.chainId} --etherscan-api-key ${process.env.BASESCAN_API_KEY} --watch`.nothrow();
          
          if (result.exitCode === 0) {
            console.log(`  ✅ ${name} verified on BaseScan`);
            verified++;
          } else {
            console.log(`  ❌ ${name} verification failed`);
            console.log(`     View at: https://basescan.org/address/${address}`);
            failed++;
          }
        } catch (error: any) {
          console.log(`  ❌ ${name} verification error:`, error.message);
          failed++;
        }
      }
    } catch (error: any) {
      console.error(`❌ Failed to read ${file}:`, error.message);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log(`📊 Verification Summary:`);
  console.log(`  ✅ Verified: ${verified}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log("=".repeat(60));

  if (failed === 0 && verified > 0) {
    console.log("\n✅ All contracts verified successfully!");
    console.log("\nView on BaseScan:");
    console.log("  https://basescan.org/");
  } else if (verified === 0) {
    console.log("\n⚠️  No contracts were verified. Deploy contracts first.");
  } else {
    console.log("\n⚠️  Some contracts failed verification.");
    console.log("This is normal if contracts were recently deployed.");
    console.log("Etherscan may need a few minutes to index the deployment.");
  }
}

function getContractPath(name: string): string | null {
  const mapping: Record<string, string> = {
    // Liquidity system
    'priceOracle': 'src/oracle/ManualPriceOracle.sol:ManualPriceOracle',
    'liquidityPaymaster': 'src/paymaster/LiquidityPaymaster.sol:LiquidityPaymaster',
    'liquidityVault': 'src/liquidity/LiquidityVault.sol:LiquidityVault',
    'feeDistributor': 'src/distributor/FeeDistributor.sol:FeeDistributor',
    
    // Rewards system
    'rewardsContract': 'src/node-rewards/NodeOperatorRewards.sol:NodeOperatorRewards',
    'jejuToken': 'src/token/elizaOSToken.sol:elizaOSToken',
    
    // Oracle
    'crossChainRelay': 'src/oracle/CrossChainPriceRelay.sol:CrossChainPriceRelay',
  };
  
  return mapping[name] || null;
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});


