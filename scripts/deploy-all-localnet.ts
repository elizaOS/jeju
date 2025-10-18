#!/usr/bin/env bun
/**
 * Deploy ALL contracts to localnet and create integration config
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const RPC_URL = 'http://localhost:8545';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

console.log('='.repeat(70));
console.log('DEPLOYING ALL CONTRACTS TO LOCALNET');
console.log('='.repeat(70));
console.log(`RPC: ${RPC_URL}`);
console.log(`Chain ID: 420691`);
console.log(`Deployer: ${DEPLOYER}`);
console.log('='.repeat(70));

const deployment: any = {
    network: 'localnet',
    chainId: 420691,
    rpcUrl: RPC_URL,
    deployer: DEPLOYER,
    timestamp: new Date().toISOString(),
    contracts: {}
};

try {
    // 1. Deploy Uniswap V4
    console.log('\n1️⃣  Deploying Uniswap V4 PoolManager...');
    const uniswapCmd = `JEJU_NETWORK=mainnet JEJU_RPC_URL=${RPC_URL} PRIVATE_KEY=${PRIVATE_KEY} bun run scripts/deploy-uniswap-v4.ts`;
    execSync(uniswapCmd, { stdio: 'inherit' });

    // Read the deployment file
    const uniswapDeployment = JSON.parse(
        execSync(`cat contracts/deployments/uniswap-v4-420691.json`).toString()
    );
    deployment.contracts.uniswap = {
        poolManager: uniswapDeployment.poolManager,
        weth: uniswapDeployment.weth
    };
    console.log(`   ✅ Uniswap V4 PoolManager: ${uniswapDeployment.poolManager}`);

    // 2. Deploy ElizaOS Token
    console.log('\n2️⃣  Deploying ElizaOS Token...');
    const elizaCmd = `cd contracts && BASESCAN_API_KEY=dummy ETHERSCAN_API_KEY=dummy forge script script/DeployLocalnet.s.sol:DeployLocalnet --rpc-url ${RPC_URL} --broadcast --legacy -vv 2>&1 | grep "ElizaOS Token deployed to:"`;
    const elizaOutput = execSync(elizaCmd).toString();
    const elizaMatch = elizaOutput.match(/0x[a-fA-F0-9]{40}/);
    if (!elizaMatch) {
        throw new Error('Failed to extract ElizaOS token address');
    }
    const elizaOSToken = elizaMatch[0];
    deployment.contracts.elizaOSToken = elizaOSToken;
    console.log(`   ✅ ElizaOS Token: ${elizaOSToken}`);

    // 3. Note about other contracts
    console.log('\n3️⃣  Additional contracts...');
    console.log('   ℹ️  JejuMarket requires PredictionOracle');
    console.log('   ℹ️  PredictionOracle is in apps/caliguland/contracts');
    console.log('   ℹ️  These can be deployed separately as needed');

    // Save deployment info
    const configPath = join(process.cwd(), 'config/localnet-config.json');
    writeFileSync(configPath, JSON.stringify(deployment, null, 2));
    console.log(`\n💾 Configuration saved to: ${configPath}`);

    // Display summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ DEPLOYMENT COMPLETE');
    console.log('='.repeat(70));
    console.log('\nDeployed Contracts:');
    console.log(`  Uniswap V4 PoolManager: ${deployment.contracts.uniswap.poolManager}`);
    console.log(`  WETH (L2 Standard):     ${deployment.contracts.uniswap.weth}`);
    console.log(`  ElizaOS Token:          ${deployment.contracts.elizaOSToken}`);
    console.log('\nConfiguration: config/localnet-config.json');
    console.log('\nNext Steps:');
    console.log('  1. Deploy PredictionOracle (from caliguland)');
    console.log('  2. Deploy JejuMarket with oracle address');
    console.log('  3. Create .env.local files for apps');
    console.log('  4. Start indexer with contract addresses');
    console.log('='.repeat(70));

} catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
}
