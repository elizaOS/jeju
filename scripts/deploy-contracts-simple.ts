#!/usr/bin/env bun
/**
 * Simple deployment script for localnet contracts
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

const RPC_URL = 'http://localhost:8545';
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

function deployContract(contractPath: string, contractName: string, constructorArgs: string[] = []): string {
    console.log(`\nDeploying ${contractName}...`);

    const argsString = constructorArgs.length > 0 ? `--constructor-args ${constructorArgs.join(' ')}` : '';
    const cmd = `cd contracts && forge create ${contractPath}:${contractName} --rpc-url ${RPC_URL} --private-key ${PRIVATE_KEY} ${argsString} --legacy`;

    console.log(`Command: ${cmd}`);

    const output = execSync(cmd, { encoding: 'utf-8' });
    console.log(output);

    // Extract deployed address
    const match = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
    if (!match) {
        throw new Error(`Failed to extract deployed address from output:\n${output}`);
    }

    const address = match[1];
    console.log(`✅ ${contractName} deployed to: ${address}`);
    return address;
}

async function main() {
    console.log('='.repeat(70));
    console.log('JEJU LOCALNET CONTRACT DEPLOYMENT');
    console.log('='.repeat(70));
    console.log(`RPC URL: ${RPC_URL}`);
    console.log(`Deployer: ${DEPLOYER}`);
    console.log('='.repeat(70));

    const deployments: any = {
        network: 'localnet',
        chainId: 420691,
        rpcUrl: RPC_URL,
        deployer: DEPLOYER,
        timestamp: new Date().toISOString(),
        contracts: {}
    };

    try {
        // Deploy ElizaOS Token
        const elizaOSToken = deployContract(
            'src/token/elizaOSToken.sol',
            'elizaOSToken',
            [DEPLOYER]
        );
        deployments.contracts.elizaOSToken = elizaOSToken;

        // Deploy PredictionOracle (from caliguland)
        console.log('\n📋 PredictionOracle is in apps/caliguland/contracts/');
        console.log('Skipping for now - needs separate compilation');

        // Deploy JejuMarket
        console.log('\n📋 JejuMarket requires:');
        console.log(`  - elizaOS: ${elizaOSToken}`);
        console.log('  - oracle: TBD');
        console.log('  - treasury: Using deployer for now');

        // For now, we can't deploy JejuMarket without oracle
        console.log('\n⚠️  Need to deploy PredictionOracle first before JejuMarket');

        // Save what we have so far
        const deploymentsPath = join(process.cwd(), 'deployments', 'localnet-contracts.json');
        writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
        console.log(`\n💾 Partial deployments saved to: ${deploymentsPath}`);

    } catch (error) {
        console.error('\n❌ Deployment failed:', error);
        process.exit(1);
    }
}

main();
