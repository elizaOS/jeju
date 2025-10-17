# Local Development

Complete guide to developing on Jeju locally.

## Quick Start

```bash
# 1. Start localnet
bun run localnet:start

# 2. Deploy contracts
cd contracts
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:9545

# 3. Start indexer (optional)
cd indexer && npm run dev

# 4. Start developing!
```

## Development Environment

### Localnet (Kurtosis)

The localnet provides a complete L1 + L2 blockchain environment:

- **L1**: Geth in dev mode (settlement layer)
- **L2**: op-geth in dev mode (Jeju execution layer)
- **Block time**: 2 seconds
- **Pre-funded accounts**: 10 Foundry accounts with 10,000 ETH each

### Pre-funded Test Accounts

```javascript
// Account 0 (default deployer)
const account0 = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
}

// Account 1
const account1 = {
  address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
}
```

## Development Workflow

### 1. Contract Development

```bash
# Watch mode for contract tests
cd contracts
forge test --watch

# Build contracts
forge build

# Deploy to localnet
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:9545
```

### 2. Frontend Development

```typescript
import { ethers } from 'ethers';

// Connect to localnet
const provider = new ethers.JsonRpcProvider('http://localhost:9545');

// Use test account
const wallet = new ethers.Wallet(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  provider
);

// Deploy your contracts and interact
```

### 3. Testing Your Changes

```bash
# Run contract tests
cd contracts && forge test

# Run integration tests
bun test tests/integration/

# Start indexer and verify
cd indexer && npm run dev
```

## Hot Reload Development

### Smart Contracts

```bash
# Terminal 1: Watch tests
cd contracts
forge test --watch --match-contract YourContract

# Terminal 2: Localnet
bun run localnet:start
```

### Scripts

```bash
# Watch mode for TypeScript
bun test --watch tests/integration/
```

## Debugging

### Contract Debugging

```bash
# Trace a transaction
forge test --match-test testYourFunction -vvvv

# Debug interactively
forge test --debug testYourFunction

# Get gas report
forge test --gas-report
```

### RPC Debugging

```bash
# Check RPC
curl -X POST http://localhost:9545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check logs
kurtosis service logs jeju-localnet op-geth
```

## Common Tasks

### Deploy All Contracts

```bash
cd contracts
forge script script/DeployLiquiditySystem.s.sol --broadcast --rpc-url http://localhost:9545
```

### Reset Localnet

```bash
bun run localnet:reset
```

### Check Indexer

```bash
cd indexer
npm run dev

# In another terminal
curl http://localhost:4350/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ blocks(limit: 1) { number } }"}'
```

## Resources

- [Quick Start Guide](./quick-start.md)
- [Deploy Contracts](./deploy-contracts.md)
- [Testing Guide](../../TESTING.md)
- [Kurtosis Documentation](../../kurtosis/README.md)

