/**
 * Example script showing how to use the configuration system
 * 
 * This demonstrates how to:
 * 1. Load chain configuration
 * 2. Get contract addresses
 * 3. Use environment variable overrides
 * 4. Update config after deployment
 */

import { ethers } from 'ethers';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { 
  loadChainConfig, 
  getContractAddress, 
  getRpcUrl, 
  getL1RpcUrl,
  type NetworkType 
} from '../../config';

async function exampleDeployment() {
  const network: NetworkType = (process.env.JEJU_NETWORK as NetworkType) || 'testnet';
  
  console.log(`\n📦 Deploying to ${network}...\n`);

  const config = loadChainConfig(network);
  console.log(`Network: ${config.name}`);
  console.log(`Chain ID: ${config.chainId}`);
  console.log(`RPC: ${getRpcUrl(network)}`);
  console.log(`L1 RPC: ${getL1RpcUrl(network)}\n`);

  const l1Provider = new ethers.JsonRpcProvider(getL1RpcUrl(network));
  const l2Provider = new ethers.JsonRpcProvider(getRpcUrl(network));

  const l1Network = await l1Provider.getNetwork();
  console.log(`✓ Connected to L1 (Chain ID: ${l1Network.chainId})`);

  const l2Network = await l2Provider.getNetwork();
  console.log(`✓ Connected to L2 (Chain ID: ${l2Network.chainId})\n`);

  const l2Bridge = getContractAddress(network, 'l2', 'L2StandardBridge');
  console.log(`L2 Standard Bridge: ${l2Bridge}`);

  const bridgeCode = await l2Provider.getCode(l2Bridge);
  if (bridgeCode !== '0x') {
    console.log(`✓ Bridge contract deployed and verified\n`);
  }

  console.log(`\n🔧 Simulating L1 contract deployment...\n`);

  const mockDeployedAddresses = {
    OptimismPortal: '0x1234567890123456789012345678901234567890',
    L2OutputOracle: '0x2345678901234567890123456789012345678901',
    L1CrossDomainMessenger: '0x3456789012345678901234567890123456789012',
    L1StandardBridge: '0x4567890123456789012345678901234567890123',
    SystemConfig: '0x5678901234567890123456789012345678901234',
  };

  console.log('Deployed L1 contracts:');
  for (const [name, address] of Object.entries(mockDeployedAddresses)) {
    console.log(`  ${name}: ${address}`);
  }

  console.log(`\n💾 Updating config file...\n`);
  updateConfigWithAddresses(network, mockDeployedAddresses);

  console.log(`✅ Deployment complete!`);
  console.log(`\n📝 Next steps:`);
  console.log(`  1. Verify contracts on block explorer`);
  console.log(`  2. Run: bun run config:validate`);
  console.log(`  3. Rebuild docs: bun run docs:build`);
  console.log(`  4. Commit changes to git\n`);
}

function updateConfigWithAddresses(
  network: NetworkType,
  addresses: Record<string, string>
): void {
  const configPath = resolve(__dirname, `../../config/chain/${network}.json`);
  const config = loadChainConfig(network);

  config.contracts.l1 = {
    ...config.contracts.l1,
    ...addresses,
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`✓ Updated ${configPath}`);
}

async function main() {
  await exampleDeployment();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});


