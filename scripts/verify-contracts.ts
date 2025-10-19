#!/usr/bin/env bun
/**
 * @title Unified Contract Verification Script
 * @notice Verifies deployed contracts on block explorers
 * @dev Supports testnet and mainnet with automatic network detection
 * 
 * Usage:
 *   bun run scripts/verify-contracts.ts testnet
 *   bun run scripts/verify-contracts.ts mainnet
 *   
 *   Or use package.json scripts:
 *   bun run verify:testnet
 *   bun run verify:mainnet
 */

import { $ } from "bun";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { getChainConfig } from "../config";
import type { NetworkType } from "../types";

async function main() {
  const network = (process.argv[2] || process.env.NETWORK || 'testnet') as NetworkType;
  
  if (network !== 'testnet' && network !== 'mainnet') {
    console.error("❌ Invalid network. Use: testnet or mainnet");
    console.error("   Usage: bun run scripts/verify-contracts.ts <network>");
    process.exit(1);
  }
  
  console.log(`🔍 Verifying contracts on ${network}...`);
  
  if (network === 'mainnet') {
    console.log("⚠️  WARNING: Mainnet verification");
  }
  
  console.log("=".repeat(60));

  const config = getChainConfig(network);
  const contractsDir = resolve(process.cwd(), "contracts");
  
  // Check for API key
  const apiKey = process.env.BASESCAN_API_KEY;
  if (!apiKey && network === 'mainnet') {
    console.error("❌ BASESCAN_API_KEY environment variable required for mainnet");
    process.exit(1);
  }
  
  // Read deployment files
  const deploymentFiles = [
    `deployments/${network}/liquidity-system.json`,
    `deployments/${network}/rewards.json`,
  ];
  
  let verified = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const file of deploymentFiles) {
    const filePath = resolve(contractsDir, file);
    
    if (!existsSync(filePath)) {
      console.log(`⚠️  Deployment file not found: ${file}`);
      skipped++;
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
            skipped++;
            continue;
          }
          
          const verifyCmd = apiKey
            ? $`cd ${contractsDir} && forge verify-contract ${address} ${contractPath} --chain-id ${config.chainId} --etherscan-api-key ${apiKey} --watch`
            : $`cd ${contractsDir} && forge verify-contract ${address} ${contractPath} --chain-id ${config.chainId} --watch`;
          
          const result = await verifyCmd.nothrow();
          
          if (result.exitCode === 0) {
            console.log(`  ✅ ${name} verified`);
            verified++;
          } else {
            console.log(`  ❌ ${name} verification failed`);
            if (network === 'mainnet') {
              console.log(`     View at: https://basescan.org/address/${address}`);
            } else {
              console.log(`     View at: https://sepolia.basescan.org/address/${address}`);
            }
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
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log("=".repeat(60));

  if (failed === 0 && verified > 0) {
    console.log("\n✅ All contracts verified successfully!");
    if (network === 'mainnet') {
      console.log("\nView on BaseScan:");
      console.log("  https://basescan.org/");
    } else {
      console.log("\nView on Base Sepolia:");
      console.log("  https://sepolia.basescan.org/");
    }
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
    
    // Node staking system (multi-token)
    'nodeStakingManager': 'src/node-staking/NodeStakingManager.sol:NodeStakingManager',
    'rewardsContract': 'src/node-staking/NodeStakingManager.sol:NodeStakingManager', // Legacy alias
    'jejuToken': 'src/token/ElizaOSToken.sol:ElizaOSToken',
    'ElizaOSToken': 'src/token/ElizaOSToken.sol:ElizaOSToken',
    
    // Oracle
    'crossChainRelay': 'src/oracle/CrossChainPriceRelay.sol:CrossChainPriceRelay',
    
    // Registry (if deployed separately)
    'identityRegistry': 'src/registry/IdentityRegistry.sol:IdentityRegistry',
    'reputationRegistry': 'src/registry/ReputationRegistry.sol:ReputationRegistry',
    'validationRegistry': 'src/registry/ValidationRegistry.sol:ValidationRegistry',
  };
  
  return mapping[name] || null;
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});


