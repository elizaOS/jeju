# Jeju Scripts

Core scripts for development, deployment, and operations.

## Quick Start

```bash
# Development
bun run dev              # Start localnet + all apps
bun run dev:vendor       # Vendor apps only (requires chain)
bun run build            # Build all components
bun run test             # Run all tests
bun run clean            # Clean build artifacts

# Deployment  
bun run deploy:testnet   # Deploy to testnet
bun run deploy:mainnet   # Deploy to mainnet
bun run deploy:cloud     # Deploy cloud integration

# Utilities
bun run apps:list        # List all apps
bun run wallet           # Show MetaMask config
bun run ports            # Check port assignments
bun run cleanup          # Kill orphaned processes
```

## Directory Structure

```
scripts/
├── dev.ts                          # Main dev environment
├── build.ts                        # Build all components
├── test-all.ts                     # Master test suite
├── deploy.ts                       # Unified deployment orchestrator
│
├── deploy/                         # Deployment helpers
│   ├── account-abstraction.ts      # Deploy AA contracts
│   ├── defi-protocols.ts           # Deploy DeFi
│   ├── l1-contracts.ts             # Deploy to Base L1
│   ├── l2-genesis.ts               # Generate genesis
│   ├── testnet.ts                  # Testnet deployment
│   ├── mainnet.ts                  # Mainnet deployment
│   └── deploy-testnet.sh           # AWS testnet deployment
│
├── localnet/                       # Localnet management
│   ├── start.ts                    # Start Kurtosis
│   ├── stop.ts                     # Stop Kurtosis
│   └── reset.ts                    # Reset Kurtosis
│
├── shared/                         # Shared utilities
│   ├── discover-apps.ts            # App discovery
│   ├── logger.ts                   # Structured logging
│   ├── format.ts                   # Formatting utils
│   ├── rpc.ts                      # RPC with failover
│   ├── notifications.ts            # Discord/Telegram
│   ├── bridge-helpers.ts           # Bridge utilities
│   ├── token-utils.ts              # Token formatting
│   ├── protocol-tokens.ts          # Token registry
│   ├── cloud-integration.ts        # Cloud service SDK
│   ├── cloud-signing.ts            # Signing utils
│   ├── eil.ts                      # EIL client SDK
│   └── get-localnet-rpc.ts         # Local RPC helper
│
├── auto-update/                    # Node auto-updates
│   └── update-manager.ts           # Auto-update manager
│
└── vendor/                         # Vendor app tools
    └── create-vendor-manifest.ts   # Create manifests
```

## Script Categories

### Development

| Script | Purpose |
|--------|---------|
| `dev.ts` | Complete development environment |
| `dev-with-vendor.ts` | Vendor apps only |
| `build.ts` | Build contracts + TypeScript |
| `test-all.ts` | Run all tests |
| `clean.ts` | Clean build artifacts |
| `cleanup-processes.ts` | Kill orphaned processes |
| `preflight-check.ts` | Verify requirements |
| `setup-apps.ts` | Initialize workspace |

### Deployment

| Script | Purpose |
|--------|---------|
| `deploy.ts` | Unified deployment orchestrator |
| `deploy-cloud-integration.ts` | Deploy cloud service contracts |
| `verify-contracts.ts` | Verify on block explorer |
| `verify-cloud-deployment.ts` | Verify cloud deployment |
| `bootstrap-localnet-complete.ts` | Deploy complete localnet |

### Utilities

| Script | Purpose |
|--------|---------|
| `list-apps.ts` | List all apps |
| `show-wallet-config.ts` | Display MetaMask config |
| `check-ports.ts` | Validate port assignments |
| `validate-manifests.ts` | Validate app manifests |

## App-Specific Scripts

Some scripts have been moved to their respective apps:

- **Monitoring scripts**: `apps/monitoring/scripts/`
- **Leaderboard scripts**: `vendor/leaderboard/scripts/`

## Common Workflows

### Local Development

```bash
bun run preflight        # Check prerequisites
bun run dev              # Start everything
```

### Deploy to Testnet/Mainnet

```bash
NETWORK=testnet bun run deploy:testnet
```

## Environment Variables

Common variables:
- `PRIVATE_KEY` / `DEPLOYER_PRIVATE_KEY` - Deployment key
- `JEJU_RPC_URL` - Jeju RPC endpoint  
- `BASE_RPC_URL` - Base RPC endpoint
- `DISCORD_WEBHOOK` - Discord notifications

## Testing

```bash
bun test scripts/shared/           # Run shared utility tests
bun test scripts/shared/format.test.ts
bun test scripts/shared/logger.test.ts  
```

## Contributing

When adding new scripts:
1. Place in appropriate subdirectory
2. Add proper JSDoc header
3. Use shared utilities from `scripts/shared/`
4. Add to this README if user-facing
5. If app-specific, consider placing in the app's directory
