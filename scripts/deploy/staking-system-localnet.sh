#!/bin/bash

# Deploy Staking System to Localnet

set -e

echo "🚀 Deploying Staking System to Localnet..."

# Configuration
export NETWORK="localnet"
export RPC_URL="http://127.0.0.1:8545"
export DEPLOYER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" # Anvil default
export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Mock Chainlink price feed for local (deploy a mock)
export ETH_USD_PRICE_FEED="0x0000000000000000000000000000000000000001" # Will deploy mock

# Initial elizaOS price: $0.10 (with 8 decimals = 10000000)
export INITIAL_ELIZA_PRICE="10000000"

cd contracts

# Deploy
forge script script/DeployStakingSystem.s.sol:DeployStakingSystem \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify=false \
    -vvv

echo "✅ Deployment complete!"
echo ""
echo "📝 Deployment saved to: contracts/deployments/localnet/staking-system.json"
echo ""
echo "🔧 Next steps:"
echo "   1. Seed liquidity: bun run scripts/seed-liquidity-local.ts"
echo "   2. Test transactions: bun run scripts/test-paymaster-local.ts"

