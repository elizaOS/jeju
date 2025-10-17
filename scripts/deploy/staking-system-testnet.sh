#!/bin/bash

# Deploy Staking System to Testnet (Base Sepolia)

set -e

echo "🚀 Deploying Staking System to Base Sepolia..."

# Load environment variables
source .env

# Configuration
export NETWORK="testnet"
export RPC_URL="${BASE_SEPOLIA_RPC_URL}"
export DEPLOYER_ADDRESS="${DEPLOYER_PUBLIC_ADDRESS}"
export PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY}"

# Base Sepolia Chainlink ETH/USD Price Feed
export ETH_USD_PRICE_FEED="0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1"

# Use existing elizaOS token if available
export ELIZA_TOKEN_ADDRESS="${ELIZA_TOKEN_TESTNET:-}"

# Initial elizaOS price: $0.10 (with 8 decimals = 10000000)
export INITIAL_ELIZA_PRICE="10000000"

cd contracts

# Deploy
forge script script/DeployStakingSystem.s.sol:DeployStakingSystem \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify \
    --etherscan-api-key $BASESCAN_API_KEY \
    -vvv

echo "✅ Deployment complete!"
echo ""
echo "📝 Deployment saved to: contracts/deployments/testnet/staking-system.json"
echo ""
echo "🔗 View contracts on BaseScan:"
echo "   https://sepolia.basescan.org/"
echo ""
echo "🔧 Next steps:"
echo "   1. Seed liquidity: bun run scripts/seed-liquidity-testnet.ts"
echo "   2. Update price oracle: bun run scripts/update-oracle-testnet.ts"
echo "   3. Test with apps: Deploy test app and integrate"

