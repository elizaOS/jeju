# Jeju L3 Smart Contracts

Smart contracts for deploying Jeju L3 on Base.

## Overview

This directory contains:
1. **L1 Deployment** - Deploy OP-Stack contracts to Base (your settlement layer)
2. **L2 Genesis** - Generate genesis.json and rollup.json for your L3
3. **L2 Contracts** - Additional contracts for your L3 (ERC-4337, governance, etc.)

## Quick Start

### 1. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Install Dependencies

```bash
cd contracts
forge install
```

This installs:
- OpenZeppelin contracts
- Optimism Bedrock contracts
- Forge standard library

### 3. Set Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit with your values
vim .env
```

Required variables:
- `DEPLOYER_PRIVATE_KEY` - Your deployment private key
- `BASE_SEPOLIA_RPC_URL` - Base Sepolia RPC (for testnet)
- `BASE_RPC_URL` - Base Mainnet RPC (for mainnet)
- `BASESCAN_API_KEY` - For contract verification

### 4. Deploy to Testnet

```bash
# Option A: Use the helper script
bun run deploy:l1:testnet

# Option B: Use Foundry directly
forge script script/Deploy.s.sol:DeployL1 \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify
```

## Structure

```
contracts/
├── foundry.toml              # Foundry configuration
├── remappings.txt            # Import remappings
├── .env.example              # Environment template
│
├── deploy-config/            # Deployment configurations
│   ├── testnet.json          # Testnet (Base Sepolia) config
│   └── mainnet.json          # Mainnet (Base) config
│
├── script/                   # Deployment scripts
│   ├── Deploy.s.sol          # Main L1 deployment
│   ├── Genesis.s.sol         # Generate L2 genesis
│   ├── DeployAA.s.sol        # Deploy ERC-4337
│   └── DeployGovernance.s.sol # Deploy governance
│
├── src/                      # Custom contracts (optional)
│   └── (add your custom contracts here)
│
├── lib/                      # Dependencies (installed by forge)
│   ├── forge-std/
│   ├── openzeppelin-contracts/
│   └── optimism/
│
└── deployments/              # Deployment artifacts
    ├── testnet/
    │   ├── addresses.json
    │   ├── genesis.json
    │   └── rollup.json
    └── mainnet/
        ├── addresses.json
        ├── genesis.json
        └── rollup.json
```

## Deployment Process

### Step 1: Deploy L1 Contracts

Deploys to Base (your settlement layer):
- OptimismPortal
- L2OutputOracle
- L1StandardBridge
- L1CrossDomainMessenger
- L1ERC721Bridge
- SystemConfig
- AddressManager
- ProxyAdmin

```bash
forge script script/Deploy.s.sol:DeployL1 \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify
```

### Step 2: Generate L2 Genesis

Generates genesis.json and rollup.json:

```bash
forge script script/Genesis.s.sol:GenerateGenesis \
  --sig "run(string)" testnet
```

This creates:
- `deployments/testnet/genesis.json` - L2 genesis state
- `deployments/testnet/rollup.json` - Rollup configuration

### Step 3: Deploy L2 Contracts (Optional)

Deploy additional L2 contracts:

**ERC-4337 (Account Abstraction)**:
```bash
forge script script/DeployAA.s.sol \
  --rpc-url https://testnet-rpc.jeju.network \
  --broadcast
```

**Governance**:
```bash
forge script script/DeployGovernance.s.sol \
  --rpc-url https://testnet-rpc.jeju.network \
  --broadcast
```

### Step 4: Update Configuration

After deployment, update contract addresses:

```bash
# Update config/chain/testnet.json with deployed addresses
vim ../config/chain/testnet.json

# Validate
bun run config:validate
```

## Using Optimism Contracts

We use Optimism's battle-tested contracts rather than rewriting them:

### Install Optimism Monorepo

```bash
forge install ethereum-optimism/optimism
```

### Reference Contracts

All OP-Stack contracts are available in:
```
lib/optimism/packages/contracts-bedrock/src/
```

Including:
- L1/OptimismPortal.sol
- L1/L2OutputOracle.sol
- L1/SystemConfig.sol
- L2/L2StandardBridge.sol
- And all other OP-Stack contracts

## Custom Contracts

Add your own contracts in `src/`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract MyContract {
    // Your code here
}
```

## Testing

```bash
# Run all tests
forge test

# Run specific test
forge test --match-contract MyContractTest

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage
```

## Verification

After deployment, verify on BaseScan:

```bash
forge verify-contract \
  --chain-id 84532 \
  --watch \
  $CONTRACT_ADDRESS \
  src/MyContract.sol:MyContract
```

## Troubleshooting

### "Library not found"

```bash
forge install
forge remappings > remappings.txt
```

### "RPC URL not set"

```bash
# Make sure .env is loaded
source .env

# Or set manually
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
```

### "Deployment failed"

Check:
1. Deployer has ETH on Base
2. RPC URL is correct
3. Private key is correct
4. Gas price is reasonable

## Next Steps

After deploying contracts:

1. Copy addresses to `../config/chain/testnet.json`
2. Copy `genesis.json` to Kubernetes ConfigMap
3. Copy `rollup.json` to op-node configuration
4. Deploy infrastructure: `bun run start`

## Resources

- [Optimism Deployment Docs](https://docs.optimism.io/builders/chain-operators/tutorials/create-l2-rollup)
- [OP-Stack Contracts](https://github.com/ethereum-optimism/optimism/tree/develop/packages/contracts-bedrock)
- [Foundry Book](https://book.getfoundry.sh/)


