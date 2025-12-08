# Gateway

Protocol infrastructure portal. Bridge tokens, deploy paymasters, provide liquidity, and run nodes.

## Setup

```bash
cd apps/gateway
bun install
```

Create `.env`:

```bash
VITE_RPC_URL=http://localhost:9545
VITE_CHAIN_ID=1337
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

Contract addresses are auto-loaded from localnet deployment.

## Run

```bash
# Development
bun run dev

# Production
bun run build
bun run preview
```

Server runs on http://localhost:4001

## Test

```bash
# Contract tests
cd ../../contracts
forge test --match-path "test/paymaster/*.t.sol"

# E2E tests
cd apps/gateway
npm run test:e2e

# Wallet tests
npm run test:wallet
```
