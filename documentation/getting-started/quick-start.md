# Quick Start

Get Jeju L3 running locally in 10 minutes. Perfect for development and testing.

## Prerequisites

Before starting, install these tools:

```bash
# macOS
brew install --cask docker
brew install kurtosis-tech/tap/kurtosis
curl -fsSL https://bun.sh/install | bash

# Verify installations
docker --version    # Need 24.0+
kurtosis version    # Need v0.90.0+
bun --version       # Need 1.0.0+
```

::: tip
See the [Installation Guide](./installation) for detailed setup instructions for Linux and Windows.
:::

## Launch Localnet (5 Steps)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/jeju.git
cd jeju
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Start Kurtosis Engine

```bash
kurtosis engine start
```

### 4. Deploy Localnet

```bash
bun run localnet:start
```

This deploys:
- ✅ L1 Ethereum (Geth + Lighthouse)
- ✅ L3 Jeju (op-reth + op-node)
- ✅ All OP-Stack services (batcher, proposer, challenger)
- ✅ Pre-funded test accounts

**Time**: 2-3 minutes (cached) or 8-10 minutes (first run)

### 5. Verify It Works

```bash
# Check latest block
cast block latest --rpc-url http://127.0.0.1:9545

# Send a test transaction
cast send 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  --value 0.1ether \
  --rpc-url http://127.0.0.1:9545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

🎉 **Success!** You now have a full L3 blockchain running locally.

## Network Configuration

Your local Jeju network:

| Parameter | Value |
|-----------|-------|
| **Chain ID** | 42069 |
| **RPC URL** | http://127.0.0.1:9545 |
| **WebSocket** | ws://127.0.0.1:9546 |
| **Block Time** | 2 seconds |
| **Sub-block Time** | 200ms (Flashblocks) |

Settlement layer (local L1):

| Parameter | Value |
|-----------|-------|
| **Chain ID** | 1337 |
| **RPC URL** | http://127.0.0.1:8545 |

## Pre-Funded Accounts

The localnet includes 10 pre-funded accounts (standard Foundry accounts):

::: details Account 0 (Primary)
```
Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Balance:     10,000 ETH
```
:::

::: details Account 1
```
Address:     0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Balance:     10,000 ETH
```
:::

::: tip
All 10 Foundry test accounts are pre-funded on both L1 and L3. See [Foundry documentation](https://book.getfoundry.sh/reference/anvil/) for the complete list.
:::

## What You Can Do Now

### Connect MetaMask

Add a custom network in MetaMask:

1. Open MetaMask → Networks → Add Network
2. Fill in:
   - **Network Name**: Jeju Local
   - **RPC URL**: `http://127.0.0.1:9545`
   - **Chain ID**: `42069`
   - **Currency Symbol**: `ETH`
3. Import the test account using the private key above

### Deploy Contracts

```bash
# Using Foundry
cd contracts
forge init my-contract

forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:9545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

### Build a dApp

```typescript
// your-dapp/src/config.ts
import { defineChain } from 'viem';

export const jejuLocal = defineChain({
  id: 42069,
  name: 'Jeju Local',
  network: 'jeju-local',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:9545'] },
  },
  testnet: true,
});
```

### View Logs

```bash
# List all services
kurtosis enclave inspect jeju-localnet

# View specific service logs
kurtosis service logs jeju-localnet el-1-op-reth-op-node

# Follow logs in real-time
kurtosis service logs jeju-localnet el-1-op-reth-op-node --follow
```

### Run Tests

```bash
# Integration tests
bun run test:integration

# E2E tests
bun run test:e2e
```

## Common Commands

```bash
# Check running enclaves
kurtosis enclave ls

# Inspect services
kurtosis enclave inspect jeju-localnet

# Stop localnet (keeps data)
bun run localnet:stop

# Reset localnet (fresh start)
bun run localnet:reset

# View all service ports
kurtosis enclave inspect jeju-localnet
```

## Troubleshooting

### "Docker daemon not running"

```bash
# macOS: Start Docker Desktop app
open -a Docker

# Linux: Start Docker service
sudo systemctl start docker
```

### "Port already in use"

```bash
# Find what's using the port
lsof -i :9545

# Kill the process
kill -9 <PID>

# Or stop existing localnet
bun run localnet:stop
```

### "Out of disk space"

```bash
# Clean up Docker
docker system prune -a

# Clean up Kurtosis
kurtosis clean -a
```

### "Enclave fails to start"

```bash
# Check logs
kurtosis enclave inspect jeju-localnet

# Force clean and retry
bun run localnet:reset
kurtosis clean -a
bun run localnet:start
```

## Performance

Expected performance on a modern laptop:

- **Block Time**: ~2 seconds
- **Transaction Confirmation**: <3 seconds
- **RPC Latency**: <50ms
- **Memory Usage**: ~8GB
- **Disk Usage**: ~10GB after 1 day

## What's Running

When you start the localnet, Kurtosis deploys:

### Layer 1 (Local Ethereum)
- **Geth**: Execution layer
- **Lighthouse**: Consensus layer (proof-of-stake)
- **Block Time**: 12 seconds
- **Chain ID**: 1337

### Layer 3 (Jeju)
- **op-reth**: Optimized Rust execution client
- **op-node**: Consensus with Flashblocks
- **op-batcher**: Posts data to L1
- **op-proposer**: Posts state roots to L1
- **Block Time**: 2 seconds
- **Sub-block Time**: 200ms
- **Chain ID**: 42069

### Smart Contracts
All OP-Stack contracts automatically deployed:
- OptimismPortal
- L1StandardBridge / L2StandardBridge
- L1CrossDomainMessenger / L2CrossDomainMessenger
- L2OutputOracle
- And more...

## Next Steps

Now that you have Jeju running locally:

1. [**Deploy Contracts**](/developers/deploy-contracts) - Learn contract deployment
2. [**Local Development**](/developers/local-development) - Deep dive into development workflow
3. [**DeFi Protocols**](/developers/defi-protocols) - Integrate with pre-deployed DeFi
4. [**Testnet Deployment**](/deployment/testnet) - Deploy to public testnet
5. [**Network Information**](/network/testnet) - Connect to live networks

## Clean Up

When you're done:

```bash
# Stop localnet (keeps state for next time)
bun run localnet:stop

# Or completely remove everything
bun run localnet:reset
kurtosis clean -a
```

---

**Questions?** Join our [Discord](https://discord.gg/jeju) or check the [Developer Guide](/developers/quick-start).

