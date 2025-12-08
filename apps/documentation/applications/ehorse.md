# eHorse

TEE oracle demo - provably fair horse racing.

**URL**: http://localhost:5700

## Concept

Game logic runs in TEE → attestation proves fairness → trustless prediction markets.

## Race Flow (90s cycle)

```
ANNOUNCE (0:00) → START (0:00) → GRACE_PERIOD (1:00) → REVEAL (1:30) → RESOLUTION
```

Grace period prevents MEV attacks.

## Four Horses

1. Thunder ⚡  2. Lightning 🌩️  3. Storm 🌪️  4. Blaze 🔥

Binary mapping: Horses 1-2 → NO, Horses 3-4 → YES

## Quick Start

```bash
cd apps/ehorse
bun run deploy   # Deploy contracts
source .env
bun run dev      # Start keeper + API
```

## A2A Skills

- `get-race-status` - Current race
- `get-horses` - Horse list
- `get-race-history` - Past results

## Contracts

- **Contest.sol** - TEE oracle with attestation verification
- **MarketFactory.sol** - Auto-creates Predimarket markets

## Testing

```bash
cd contracts
forge test --match-contract ContestTest -vv
```
