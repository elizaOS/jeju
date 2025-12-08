# Open Intents Framework (OIF)

Cross-chain intent infrastructure for the Jeju network. Enables trustless, permissionless cross-chain swaps via intents.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    User     │────▶│ InputSettler │────▶│  Aggregator │
│  (Source)   │     │  (Lock $)    │     │   (Route)   │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                    ┌──────────────┐     ┌──────▼──────┐
                    │   Oracle     │◀────│   Solver    │
                    │  (Attest)    │     │   (Fill)    │
                    └──────┬───────┘     └──────┬──────┘
                           │                    │
                    ┌──────▼───────┐     ┌──────▼──────┐
                    │ InputSettler │◀────│OutputSettler│
                    │  (Release)   │     │  (Deliver)  │
                    └──────────────┘     └─────────────┘
```

## Components

### Aggregator (`aggregator/`)
A2A + MCP server for intent routing and quote aggregation.

```bash
cd aggregator && bun run dev  # Port 4010
```

**A2A Skills:**
- `create-intent` - Create cross-chain swap
- `get-quote` - Get best price from solvers
- `track-intent` - Monitor intent status
- `list-routes` - Available routes
- `list-solvers` - Active solvers

**MCP Resources:**
- `oif://routes` - Route statistics
- `oif://solvers` - Solver leaderboard
- `oif://intents/recent` - Recent intents
- `oif://stats` - Global analytics

### Solver (`solver/`)
Autonomous agent that monitors and fills intents for profit.

```bash
cd solver && bun run dev
```

**Features:**
- Multi-chain event monitoring
- Profitability evaluation
- Liquidity management
- Automatic fills

### Viewer (`viewer/`)
React frontend for visualizing intents, routes, and solvers.

```bash
cd viewer && bun run dev  # Port 4011
```

**Views:**
- **Intents** - Live feed with status filters
- **Routes** - Route cards with metrics
- **Solvers** - Leaderboard and cards
- **Analytics** - Charts and stats

## Smart Contracts

Located in `/packages/contracts/src/oif/`:

| Contract | Description |
|----------|-------------|
| `InputSettler.sol` | Locks user funds, receives intents (ERC-7683) |
| `OutputSettler.sol` | Delivers tokens to recipient on destination |
| `SolverRegistry.sol` | Solver staking, slashing, reputation |
| `OracleAdapter.sol` | Pluggable oracle (Hyperlane, Superchain, Simple) |

### Deploy

```bash
cd /packages/contracts
forge script script/DeployOIF.s.sol --rpc-url $RPC_URL --broadcast
```

## Configuration

Copy `.env.example` and configure:

```env
# Aggregator
AGGREGATOR_PORT=4010

# Contracts per chain
OIF_INPUT_SETTLER_8453=0x...
OIF_OUTPUT_SETTLER_8453=0x...
OIF_SOLVER_REGISTRY_8453=0x...

# Solver
SOLVER_PRIVATE_KEY=0x...
```

## API Examples

### Create Intent
```bash
curl -X POST http://localhost:4010/api/intents \
  -H "Content-Type: application/json" \
  -d '{
    "sourceChain": 8453,
    "destinationChain": 42161,
    "sourceToken": "0x0000000000000000000000000000000000000000",
    "destinationToken": "0x0000000000000000000000000000000000000000",
    "amount": "1000000000000000000"
  }'
```

### Get Quote
```bash
curl -X POST http://localhost:4010/api/intents/quote \
  -H "Content-Type: application/json" \
  -d '{
    "sourceChain": 8453,
    "destinationChain": 42161,
    "sourceToken": "0x0000000000000000000000000000000000000000",
    "destinationToken": "0x0000000000000000000000000000000000000000",
    "amount": "1000000000000000000"
  }'
```

### A2A Message
```bash
curl -X POST http://localhost:4010/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "1",
        "parts": [{
          "kind": "data",
          "data": {"skillId": "get-stats"}
        }]
      }
    },
    "id": 1
  }'
```

## Testing

```bash
# Contract tests
cd /packages/contracts && forge test --match-path test/OIF.t.sol

# Aggregator
cd aggregator && bun test

# Viewer build
cd viewer && bun run build
```

## Integration

### Gateway
Import the hook:
```typescript
import { useCreateIntent, useIntentStatus } from '../hooks/useOIF';
```

### Bazaar
Import crosschain lib:
```typescript
import { getCrossChainQuotes, createIntent } from '../lib/crosschain';
```

### Indexer
OIF events are processed by `src/oif-processor.ts` and stored in GraphQL entities.

