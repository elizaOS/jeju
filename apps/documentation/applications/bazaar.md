# Bazaar

DeFi + NFT + Prediction Markets hub.

**URL**: http://localhost:4006 | https://bazaar.jeju.network

## Features

- **Token Launchpad**: Deploy ERC20s with bonding curves
- **DEX**: Uniswap V4 swaps with custom hooks
- **Liquidity**: Concentrated liquidity positions
- **Prediction Markets**: LMSR automated market maker
- **NFT Marketplace**: Browse and trade NFTs
- **Games**: ERC-8004 registered game discovery

## Routes

| Route | Description |
|-------|-------------|
| `/tokens` | Token discovery |
| `/tokens/create` | Launch new tokens |
| `/swap` | Token swaps |
| `/pools` | Liquidity overview |
| `/markets` | Prediction markets |
| `/portfolio` | Your positions |
| `/nfts` | NFT marketplace |

## Stack

Next.js 14, React 19, Wagmi 2, Viem 2, TanStack Query, Tailwind, Radix UI

## LMSR Pricing

```typescript
yesPrice = exp(yesShares / b) / (exp(yesShares / b) + exp(noShares / b))
noPrice = 1 - yesPrice
// b = liquidity parameter (100 ETH default)
```

## Development

```bash
cd apps/bazaar
bun install
bun run dev
```

## Testing

```bash
bun run test        # All tests
bun run test:unit   # Unit tests
bun run test:e2e    # E2E tests
```
