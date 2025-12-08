# RPC Methods

Standard Ethereum JSON-RPC.

## Examples

```bash
# Block number
curl -X POST https://rpc.jeju.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Balance
curl -X POST https://rpc.jeju.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x...","latest"],"id":1}'

# Send tx
curl -X POST https://rpc.jeju.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":["0x..."],"id":1}'
```

## Supported APIs

- `eth` - Standard Ethereum
- `net` - Network info
- `web3` - Client version
- `txpool` - Transaction pool (some nodes)
- `trace` - Tracing (archive nodes)

## Rate Limits

| Tier | Limit |
|------|-------|
| Public | 100 req/s, 5k req/min |
| Own node | Unlimited |

For higher limits: [Run your own node](./run-rpc-node)
