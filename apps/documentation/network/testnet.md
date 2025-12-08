# Testnet

| Parameter | Value |
|-----------|-------|
| Chain ID | 420690 |
| RPC | https://testnet-rpc.jeju.network |
| WebSocket | wss://testnet-ws.jeju.network |
| Explorer | https://testnet-explorer.jeju.network |
| Settlement | Base Sepolia (84532) |

## Add to Wallet

```
Network: Jeju Testnet
RPC: https://testnet-rpc.jeju.network
Chain ID: 420690
Symbol: ETH
Explorer: https://testnet-explorer.jeju.network
```

Or: [chainlist.org/chain/420690](https://chainlist.org/chain/420690)

## Get Testnet ETH

1. **Faucet**: https://faucet.jeju.network
2. **Bridge**: Sepolia → Base Sepolia → Jeju (via Superbridge + Jeju Bridge)
3. **Discord**: Ask in #testnet-faucet

## Viem Config

```typescript
import { defineChain } from 'viem';

export const jejuTestnet = defineChain({
  id: 420690,
  name: 'Jeju Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.jeju.network'], webSocket: ['wss://testnet-ws.jeju.network'] },
  },
  blockExplorers: { default: { name: 'Explorer', url: 'https://testnet-explorer.jeju.network' } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated: 1 } },
  testnet: true,
});
```

## Rate Limits

- 50 req/s per IP
- 2,000 req/min per IP

## Network Details

- Block time: 2s
- Flashblocks: 200ms
- Gas limit: 30M
- Batch interval: ~10 min
- State root: ~1 hr
- Challenge period: 7 days

## Current Limitations

- Training wheels mode (no fault proofs yet)
- Single sequencer
- May be reset periodically
