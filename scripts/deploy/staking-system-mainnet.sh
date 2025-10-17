#!/bin/bash

# Deploy Staking System to Mainnet

set -e

echo "⚠️  WARNING: Deploying to MAINNET"
echo "=================================="
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 1
fi

echo ""
echo "🚀 Deploying Staking System to Mainnet..."

# Load environment variables
source .env

# Configuration
export NETWORK="mainnet"
export RPC_URL="${MAINNET_RPC_URL}"
export DEPLOYER_ADDRESS="${DEPLOYER_PUBLIC_ADDRESS}"
export PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY}"

# Base Mainnet Chainlink ETH/USD Price Feed
export ETH_USD_PRICE_FEED="0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"

# Use existing elizaOS token (bridged from Base)
export ELIZA_TOKEN_ADDRESS="${ELIZA_TOKEN_MAINNET}"

# Initial elizaOS price: Get from CoinGecko or manual input
if [ -z "$INITIAL_ELIZA_PRICE" ]; then
    read -p "Enter current elizaOS price (8 decimals, e.g., 10000000 for $0.10): " price_input
    export INITIAL_ELIZA_PRICE="$price_input"
fi

echo ""
echo "Configuration:"
echo "  Network: Mainnet"
echo "  Deployer: $DEPLOYER_ADDRESS"
echo "  elizaOS Token: $ELIZA_TOKEN_ADDRESS"
echo "  Initial Price: \$$(echo "scale=2; $INITIAL_ELIZA_PRICE / 100000000" | bc)"
echo ""
read -p "Proceed with deployment? (yes/no): " final_confirm

if [ "$final_confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 1
fi

cd contracts

# Deploy with extra verification
forge script script/DeployStakingSystem.s.sol:DeployStakingSystem \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify \
    --etherscan-api-key $BASESCAN_API_KEY \
    --slow \
    -vvvv

echo ""
echo "✅ Deployment complete!"
echo "=================================="
echo ""
echo "📝 Deployment saved to: contracts/deployments/mainnet/staking-system.json"
echo ""
echo "🔗 View contracts on BaseScan:"
echo "   https://basescan.org/"
echo ""
echo "⚠️  CRITICAL Next Steps:"
echo "   1. Transfer ownership to multi-sig"
echo "   2. Seed initial liquidity (from treasury)"
echo "   3. Set up price oracle automation"
echo "   4. Test thoroughly before announcing"
echo "   5. Set up monitoring & alerts"
echo ""
echo "📚 Documentation:"
echo "   - Update README with contract addresses"
echo "   - Publish audit results"
echo "   - Create integration guide for apps"
echo "=================================="

