# Bazaar

Unified token launchpad, Uniswap V4 DEX, NFT marketplace, and prediction markets.

## Setup

```bash
cd apps/bazaar
bun install
```

Create `.env.local`:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_CHAIN_ID=1337
NEXT_PUBLIC_RPC_URL=http://localhost:9545
NEXT_PUBLIC_INDEXER_URL=http://localhost:4350/graphql
NEXT_PUBLIC_POOL_MANAGER=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

## Run

```bash
# Development
bun run dev

# Production
bun run build
bun run start
```

Server runs on http://localhost:4006

## Test

```bash
# All tests
bun run test

# Unit tests
bun run test:unit

# E2E tests
bun run test:e2e

# Wallet tests (requires headed browser)
bun run test:wallet
```
