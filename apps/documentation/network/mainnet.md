# Mainnet

| Parameter | Value |
|-----------|-------|
| Chain ID | 420691 |
| RPC | https://rpc.jeju.network |
| WebSocket | wss://ws.jeju.network |
| Explorer | https://explorer.jeju.network |
| Settlement | Base (8453) |

## Add to Wallet

```
Network: Jeju
RPC: https://rpc.jeju.network
Chain ID: 420691
Symbol: ETH
Explorer: https://explorer.jeju.network
```

Or: [chainlist.org/chain/420691](https://chainlist.org/chain/420691)

## Get ETH

1. **Bridge from Base**: https://bridge.jeju.network (~5 min)
2. **From Ethereum**: Bridge to Base first via Superbridge

## Viem Config

```typescript
import { defineChain } from 'viem';

export const jeju = defineChain({
  id: 420691,
  name: 'Jeju',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.jeju.network'], webSocket: ['wss://ws.jeju.network'] },
  },
  blockExplorers: { default: { name: 'Explorer', url: 'https://explorer.jeju.network' } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated: 1 } },
});
```

## Rate Limits

- 100 req/s per IP
- 5,000 req/min per IP

For production: [Run your own node](/developers/run-rpc-node)

## Gas Estimates

| Tx Type | Gas |
|---------|-----|
| ETH transfer | ~21k |
| ERC-20 transfer | ~65k |
| Uniswap swap | ~150k |
| NFT mint | ~80k |

Fees are 10-100x cheaper than Base.

## Withdrawals

**Standard**: 7 days (challenge period) + 7 days (Base→Ethereum)  
**Fast**: ~15 min via Hop/Across (small fee)

## Status

https://status.jeju.network
