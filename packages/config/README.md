# Jeju Configuration

Centralized configuration for the Jeju network.

## Files

### Chain Configuration
- **`index.ts`** - Chain configuration loader with environment variable support
- **`chain/`** - Network-specific configs
  - `mainnet.json` - Production network (Chain ID: 420691)
  - `testnet.json` - Test network (Chain ID: 420690)
  - `localnet.json` - Local development (Chain ID: 1337)

### Token Configuration
- **`tokens.json`** - Unified token registry with:
  - Token addresses and metadata
  - Paymaster support status
  - Bridge configuration
  - Market data and DEX pools
  - Oracle configuration

### Port Configuration
- **`ports.ts`** - Centralized port allocation
  - Storage services: 3100-3199
  - Core app frontends/APIs: 4000-4399
  - Indexer services: 4350-4399
  - Vendor apps: 5000-5599
  - Infrastructure: 8545-9999

## Usage

### Chain Configuration

```typescript
import { getChainConfig, getRpcUrl, getContractAddress } from './config';

// Load chain config (respects JEJU_NETWORK env var)
const config = getChainConfig('mainnet');

// Get RPC URL with env var override
const rpcUrl = getRpcUrl('testnet');
// Returns: process.env.JEJU_RPC_URL || config.rpcUrl

// Get contract address
const bridge = getContractAddress('mainnet', 'l2', 'L2StandardBridge');
```

### Token Configuration

```typescript
import { getToken, getPaymasterTokens, getBridgeableTokens } from '../scripts/shared/protocol-tokens';

// Get a specific token
const clanker = getToken('CLANKER');

// Get tokens with paymaster support
const paymasterTokens = getPaymasterTokens();

// Get bridgeable tokens
const bridgeable = getBridgeableTokens();
```

### Port Configuration

```typescript
import { CORE_PORTS, getCoreAppUrl } from '@config/ports';

// Get port with environment override
const port = CORE_PORTS.BAZAAR.get();

// Get full URL with environment override
const apiUrl = getCoreAppUrl('BAZAAR');
```

## Environment Variables

### Network Selection
```bash
JEJU_NETWORK=localnet|testnet|mainnet
```

### RPC Overrides
```bash
JEJU_RPC_URL=http://localhost:9545
JEJU_WS_URL=ws://localhost:9546
JEJU_EXPLORER_URL=http://localhost:4000
JEJU_L1_RPC_URL=http://localhost:8545
```

### Port Overrides
```bash
# Core apps
BAZAAR_PORT=4006
GATEWAY_PORT=4001
INDEXER_GRAPHQL_PORT=4350

# Vendor apps
VENDOR_HYPERSCAPE_CLIENT_PORT=3333
VENDOR_CLOUD_PORT=5006

# Infrastructure
L2_RPC_PORT=9545
PROMETHEUS_PORT=9090
```

## Validation

```bash
# Check port configuration
bun run scripts/check-ports.ts

# Run config tests
bun test packages/config/index.test.ts
```

## OP Stack Deployment

OP Stack deployment configs are in `contracts/deploy-config/`:
- `contracts/deploy-config/mainnet.json`
- `contracts/deploy-config/testnet.json`

These are input files for `op-node genesis l2` command during chain deployment.
