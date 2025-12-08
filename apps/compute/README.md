# @jeju/compute

**Decentralized AI Compute Marketplace**

A decentralized compute marketplace built on ERC-8004 for AI inference. No API keys - only wallet signatures.

## Goals

1. **100% Permissionless** - No API keys, no logins, only wallet signatures
2. **Decentralized Registry** - Providers register via ERC-8004 on-chain
3. **Hardware Attestation** - Cryptographic proof of GPU/TEE capabilities
4. **Stake-based Security** - Users and providers stake for accountability
5. **Open Gateway** - Any gateway can route to any provider

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER / GAME CLIENT                        │
│                    (Wallet-based authentication)                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                           GATEWAY                                │
│   Provider Discovery → Request Router → Response Verifier        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   COMPUTE NODE  │  │   COMPUTE NODE  │  │   COMPUTE NODE  │
│   (Local Demo)  │  │   (Phala TEE)   │  │   (GPU Server)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BLOCKCHAIN LAYER                           │
│   Provider Registry (ERC-8004) | Staking | Escrow | Reputation   │
│                                                                  │
│   Chains: Anvil (local) → Base Sepolia → Base Mainnet            │
└─────────────────────────────────────────────────────────────────┘
```

## Smart Contracts

Located in `packages/contracts/src/compute/`:

- **ComputeRegistry** - ERC-8004 extension for compute providers
- **LedgerManager** - User ledger and payment management
- **InferenceServing** - Payment settlement for inference jobs
- **ComputeStaking** - User and provider stake management

## Compute Node

Providers run nodes that:
- Detect and attest hardware (GPU/TEE)
- Serve OpenAI-compatible inference
- Generate cryptographic attestations
- Register on-chain via ERC-8004

## Quick Start

### Prerequisites

- Bun 1.0+
- Wallet with testnet ETH (Base Sepolia)
- Docker (for node deployment)

### Run Demo

```bash
# Install dependencies
bun install

# Run automated demo on Anvil
bun run demo

# Start a compute node
bun run node
```

### Run Tests

```bash
bun run test
```

### Deploy Contracts

```bash
# First, build contracts
cd packages/contracts && forge build

# Deploy to Base Sepolia
NETWORK=sepolia bun run deploy:sepolia

# Deploy to Base Mainnet
NETWORK=mainnet bun run deploy:mainnet
```

## Security Model

### Staking Requirements

| Role | Minimum Stake | Purpose |
|------|---------------|---------|
| User | 0.01 ETH | Prevent spam/abuse |
| Provider | 0.1 ETH | Accountable for service quality |
| Guardian | 1.0 ETH | Moderation privileges |

### Trust Models

1. **Reputation** - ERC-8004 feedback from users
2. **Attestation** - Hardware verification (TEE/GPU)
3. **Staking** - Economic security via slashing

## Supported Hardware

| Platform | TEE Type | Status |
|----------|----------|--------|
| Intel TDX | Hardware | Production |
| NVIDIA H100/H200 | GPU TEE | Production |
| Apple MLX | Secure Enclave | Beta |
| Simulated | None | Testing only |

## Project Structure

```
apps/compute/
├── src/
│   ├── compute/         # Core compute marketplace
│   │   ├── node/        # Compute node implementation
│   │   ├── sdk/         # Client SDK
│   │   ├── scripts/     # Deployment scripts
│   │   └── tests/       # Test suites
│   ├── storage/         # Arweave storage
│   ├── tee/             # TEE abstractions
│   └── infra/           # Blockchain clients
└── deployments/         # Deployment artifacts
```

## Related Projects

- [ERC-8004](https://github.com/ethereum/EIPs) - Trustless Agents standard
- [Arweave](https://www.arweave.org/) - Permanent storage
- [DStack](https://github.com/phala-network/dstack) - TEE framework

## License

MIT
