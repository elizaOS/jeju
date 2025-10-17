# Jeju Localnet with Kurtosis

Automated local blockchain deployment for Jeju development and testing.

## Overview

This Kurtosis package deploys a complete Jeju blockchain environment on your local machine:

- **L1 Layer**: Geth in dev mode (auto-mines blocks every 1 second)
- **L2 Layer**: op-geth in dev mode (auto-mines blocks every 2 seconds)
- **Pure TCP**: No UDP/QUIC issues on macOS Docker Desktop
- **Pre-funded Accounts**: 10 Foundry default accounts with ETH
- **Fast Setup**: 2-3 minutes from zero to fully running blockchain

## Architecture

```
┌─────────────────────────────────────────┐
│ L1: Geth Dev Mode                        │
│ - Auto-mining every 1 second             │
│ - Chain ID: 1337 (dev mode default)     │
│ - RPC: 0.0.0.0:8545                     │
│ - WebSocket: 0.0.0.0:8546               │
└─────────────┬───────────────────────────┘
              │
              │ (Simplified for local dev)
              ↓
┌─────────────────────────────────────────┐
│ L2: op-geth Dev Mode                    │
│ - Auto-mining every 2 seconds           │
│ - Simplified execution layer            │
│ - RPC: 0.0.0.0:9545                     │
│ - WebSocket: 0.0.0.0:9546               │
│ - No op-node/batcher (not needed)       │
└─────────────────────────────────────────┘
```

## Quick Start

### 1. Prerequisites

```bash
# macOS
brew install --cask docker
brew install kurtosis-tech/tap/kurtosis

# Linux
curl -fsSL https://get.docker.com | sh
echo "deb [trusted=yes] https://apt.fury.io/kurtosis-tech/ /" | sudo tee /etc/apt/sources.list.d/kurtosis.list
sudo apt-get update && sudo apt-get install -y kurtosis-cli

# Start Docker
open -a Docker  # macOS
# or
sudo systemctl start docker  # Linux
```

### 2. Start Localnet

```bash
# From project root
bun run localnet:start

# Or manually
kurtosis run github.com/jejunetwork/jeju --enclave-id jeju-localnet
```

### 3. Get Endpoints

```bash
# Inspect running enclave
kurtosis enclave inspect jeju-localnet

# Get L2 RPC port
kurtosis port print jeju-localnet op-geth rpc
# Output: http://127.0.0.1:XXXXX (port is randomized)

# Get L1 RPC port
kurtosis port print jeju-localnet geth-l1 rpc
```

### 4. Connect and Use

```typescript
import { ethers } from 'ethers';

// Connect to L2 (Jeju)
const l2Provider = new ethers.JsonRpcProvider('http://127.0.0.1:9545');

// Use Foundry default account
const wallet = new ethers.Wallet(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  l2Provider
);

// Send transaction
const tx = await wallet.sendTransaction({
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  value: ethers.parseEther('1.0'),
});

await tx.wait();
console.log('Transaction confirmed!');
```

## Configuration

### Kurtosis Package (kurtosis.yml)

```yaml
name: github.com/jejunetwork/jeju
```

### Deployment Script (main.star)

The `main.star` file is a Starlark script that defines the localnet deployment:

```python
def run(plan, args={}):
    """
    Deploy minimal L1 + L2 for local development
    
    Services:
    - geth-l1: Geth in dev mode (L1 settlement layer)
    - op-geth: OP-Geth in dev mode (L2 execution layer)
    
    All services use TCP only (no UDP) for macOS compatibility.
    """
    
    # ... deployment logic
```

## Pre-funded Accounts

All Foundry default accounts are pre-funded with 10,000 ETH:

### Account 0 (Deployer)
```
Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Balance:     10,000 ETH
```

### Account 1
```
Address:     0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Balance:     10,000 ETH
```

[See Foundry docs](https://book.getfoundry.sh/reference/anvil/) for all 10 accounts.

## Network Parameters

### L1 (Geth Dev Mode)
- **Chain ID**: 1337 (auto-set by --dev mode)
- **Block Time**: 1 second
- **Gas Limit**: 30,000,000
- **Consensus**: None (dev mode auto-mines)

### L2 (OP-Geth Dev Mode)
- **Chain ID**: 1337
- **Block Time**: 2 seconds (--dev.period=2)
- **Gas Limit**: 30,000,000
- **OP-Stack Mode**: Simplified (no sequencer/batcher needed for dev)

## Commands

### Deployment

```bash
# Start localnet
bun run localnet:start

# Stop localnet (keeps state)
bun run localnet:stop

# Reset localnet (clean start)
bun run localnet:reset

# Or use Kurtosis directly
kurtosis run . --enclave-id jeju-localnet
kurtosis enclave stop jeju-localnet
kurtosis enclave rm jeju-localnet --force
```

### Monitoring

```bash
# List running enclaves
kurtosis enclave ls

# Inspect services
kurtosis enclave inspect jeju-localnet

# View logs
kurtosis service logs jeju-localnet geth-l1 --follow
kurtosis service logs jeju-localnet op-geth --follow

# Shell into service
kurtosis service shell jeju-localnet op-geth
```

### Testing

```bash
# Quick RPC test
cast block latest --rpc-url http://127.0.0.1:9545

# Send test transaction
cast send 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  --value 1ether \
  --rpc-url http://127.0.0.1:9545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Check balance
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://127.0.0.1:9545
```

## Troubleshooting

### "Docker daemon not running"

```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### "Port already in use"

```bash
# Find and kill process using the port
lsof -i :9545
kill -9 <PID>

# Or stop existing localnet
bun run localnet:stop
```

### "Kurtosis enclave fails to start"

```bash
# Clean everything
kurtosis clean -a

# Retry
bun run localnet:start
```

### "Out of disk space"

```bash
# Clean Docker
docker system prune -a

# Clean Kurtosis
kurtosis clean -a
```

## Development Workflow

### 1. Start Localnet

```bash
bun run localnet:start
```

### 2. Deploy Contracts

```bash
cd contracts

# Deploy liquidity system
forge script script/DeployLiquiditySystem.s.sol \
  --broadcast \
  --rpc-url http://127.0.0.1:9545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 3. Start Indexer (Optional)

```bash
cd indexer
npm run dev
```

### 4. Develop Your dApp

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:9545');
const wallet = new ethers.Wallet('0xac09...', provider);

// Deploy your contracts
// Test your dApp
// Iterate quickly with instant finality
```

### 5. Run Tests

```bash
# Contract tests
cd contracts && forge test

# Integration tests
bun test tests/integration/

# E2E tests
bun test tests/e2e/
```

## Performance

Expected performance on modern laptop:

- **Startup Time**: 2-3 minutes (first time), 30s (cached)
- **Block Time**: L1 ~1s, L2 ~2s
- **Transaction Confirmation**: <3 seconds
- **RPC Latency**: <50ms
- **Memory Usage**: ~4-8GB
- **Disk Usage**: ~5GB

## Differences from Production

This localnet is simplified for fast local development:

### What's Included
- ✅ L1 (Geth dev mode)
- ✅ L2 (op-geth dev mode)
- ✅ Auto-mining
- ✅ Pre-funded accounts
- ✅ RPC/WebSocket endpoints

### What's Simplified
- ⚠️ No op-node (not needed for dev mode)
- ⚠️ No op-batcher (not needed for dev mode)
- ⚠️ No op-proposer (not needed for dev mode)
- ⚠️ No fraud proofs
- ⚠️ No real consensus

### For Production Testing
Use testnet or mainnet deployment instead. See `deployment/` docs.

## Port Mapping

Kurtosis assigns random ports to avoid conflicts. Get actual ports with:

```bash
kurtosis enclave inspect jeju-localnet
```

Expected services:
- `geth-l1` - L1 RPC on port 8545 (HTTP), 8546 (WS)
- `op-geth` - L2 RPC on port 9545 (HTTP), 9546 (WS)

## Advanced Usage

### Custom Kurtosis Args

```bash
kurtosis run . --enclave-id jeju-localnet --args '{"custom_arg": "value"}'
```

### Persistent Data

Kurtosis enclaves can be stopped without losing state:

```bash
# Stop (keeps data)
kurtosis enclave stop jeju-localnet

# Resume
kurtosis enclave start jeju-localnet
```

### Multiple Enclaves

Run multiple independent localnet instances:

```bash
kurtosis run . --enclave-id jeju-local-1
kurtosis run . --enclave-id jeju-local-2
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Kurtosis
        run: |
          echo "deb [trusted=yes] https://apt.fury.io/kurtosis-tech/ /" | sudo tee /etc/apt/sources.list.d/kurtosis.list
          sudo apt-get update
          sudo apt-get install -y kurtosis-cli
      
      - name: Start localnet
        run: bun run localnet:start
      
      - name: Run tests
        run: bun test
      
      - name: Cleanup
        run: bun run localnet:stop
```

## Resources

- **Kurtosis Docs**: https://docs.kurtosis.com/
- **Starlark Language**: https://github.com/bazelbuild/starlark
- **OP-Stack Docs**: https://docs.optimism.io/
- **Geth Docs**: https://geth.ethereum.org/docs/

## Support

- Discord: [#localnet-support](https://discord.gg/jeju)
- GitHub Issues: [Report problems](https://github.com/jeju-l3/jeju/issues)
- Documentation: [Full docs](https://docs.jeju.network)

## Next Steps

- [Deploy Contracts](../contracts/README.md) - Deploy your smart contracts
- [Start Indexer](../indexer/README.md) - Index blockchain data
- [Integration Tests](../tests/integration/) - Test your contracts
- [Developer Guide](../documentation/developers/quick-start.md) - Build dApps

