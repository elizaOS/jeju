#!/bin/bash
# ERC-8004 v1.0 Multi-Chain Deployment Script
# Usage: ./deploy.sh <network>
# Networks: sepolia, base_sepolia, optimism_sepolia, zg_testnet, all

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with:"
    echo "  PRIVATE_KEY=your_private_key"
    echo "  SEPOLIA_RPC_URL=..."
    echo "  BASE_SEPOLIA_RPC_URL=..."
    echo "  OPTIMISM_SEPOLIA_RPC_URL=..."
    echo "  ZG_TESTNET_RPC_URL=..."
    exit 1
fi

source .env

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set in .env${NC}"
    exit 1
fi

# Function to deploy to a network
deploy_network() {
    local network=$1
    local rpc_var=$2
    local chain_name=$3
    local verify_flag=$4
    
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}Deploying to ${chain_name}${NC}"
    echo -e "${BLUE}========================================${NC}\n"
    
    # Check if RPC URL is set
    local rpc_url=$(eval echo \$$rpc_var)
    if [ -z "$rpc_url" ]; then
        echo -e "${YELLOW}Warning: ${rpc_var} not set, skipping ${chain_name}${NC}"
        return
    fi
    
    # Deploy
    echo -e "${GREEN}Deploying contracts...${NC}"
    if [ "$verify_flag" = "verify" ]; then
        forge script script/Deploy.s.sol:Deploy \
            --rpc-url $network \
            --broadcast \
            --verify \
            -vvv
    else
        forge script script/Deploy.s.sol:Deploy \
            --rpc-url $network \
            --broadcast \
            -vvv
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully deployed to ${chain_name}!${NC}"
    else
        echo -e "${RED}❌ Deployment to ${chain_name} failed${NC}"
        return 1
    fi
}

# Parse command line argument
NETWORK=${1:-help}

case $NETWORK in
    sepolia)
        deploy_network "sepolia" "SEPOLIA_RPC_URL" "Ethereum Sepolia" "verify"
        ;;
    base_sepolia)
        deploy_network "base_sepolia" "BASE_SEPOLIA_RPC_URL" "Base Sepolia" "verify"
        ;;
    optimism_sepolia)
        deploy_network "optimism_sepolia" "OPTIMISM_SEPOLIA_RPC_URL" "Optimism Sepolia" "verify"
        ;;
    mode_testnet)
        deploy_network "mode_testnet" "MODE_TESTNET_RPC_URL" "Mode Testnet" "verify"
        ;;
    zg_testnet)
        echo -e "${YELLOW}Note: 0G testnet verification not yet supported via forge${NC}"
        deploy_network "zg_testnet" "ZG_TESTNET_RPC_URL" "0G Testnet" "no-verify"
        ;;
    all)
        echo -e "${GREEN}Deploying to all testnets...${NC}"
        deploy_network "sepolia" "SEPOLIA_RPC_URL" "Ethereum Sepolia" "verify"
        deploy_network "base_sepolia" "BASE_SEPOLIA_RPC_URL" "Base Sepolia" "verify"
        deploy_network "optimism_sepolia" "OPTIMISM_SEPOLIA_RPC_URL" "Optimism Sepolia" "verify"
        deploy_network "mode_testnet" "MODE_TESTNET_RPC_URL" "Mode Testnet" "verify"
        deploy_network "zg_testnet" "ZG_TESTNET_RPC_URL" "0G Testnet" "no-verify"
        echo -e "\n${GREEN}✅ All deployments complete!${NC}"
        ;;
    help|*)
        echo -e "${BLUE}ERC-8004 v1.0 Deployment Script${NC}"
        echo ""
        echo "Usage: ./deploy.sh <network>"
        echo ""
        echo "Available networks:"
        echo "  sepolia           - Ethereum Sepolia testnet"
        echo "  base_sepolia      - Base Sepolia testnet"
        echo "  optimism_sepolia  - Optimism Sepolia testnet"
        echo "  mode_testnet      - Mode Testnet"
        echo "  zg_testnet        - 0G testnet"
        echo "  all               - Deploy to all testnets"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh sepolia"
        echo "  ./deploy.sh all"
        echo ""
        echo "Prerequisites:"
        echo "  1. Create .env file with PRIVATE_KEY and RPC URLs"
        echo "  2. Ensure deployer wallet has testnet tokens"
        echo "  3. Set block explorer API keys for verification"
        exit 0
        ;;
esac

