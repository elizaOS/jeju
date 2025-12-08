# Introduction

Jeju is an L3 blockchain built on OP-Stack, settling on Base.

```
Ethereum L1 ← Base L2 ← Jeju
```

## Key Specs

| Feature | Value |
|---------|-------|
| Block time | 2s (200ms with Flashblocks) |
| Settlement | Base (Coinbase L2) |
| Data availability | EigenDA + calldata fallback |
| Security | Ethereum via fraud proofs |

## Stack

- **Execution**: Reth (Rust)
- **Consensus**: OP-Node + Flashblocks
- **DA**: EigenDA with calldata fallback

## Next Steps

- [Quick Start](./quick-start) - Run locally in 10 min
- [Developer Guide](/developers/quick-start) - Deploy contracts
- [Network Info](/network/testnet) - Connect to testnet/mainnet
