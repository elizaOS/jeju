# Architecture

## Stack

```
Ethereum L1 (finality)
    ↑
Base L2 (settlement, 7-day challenge)
    ↑
Jeju (execution, 200ms Flashblocks)
    ↓
EigenDA (data availability, calldata fallback)
```

## Components

### Execution: Reth / op-geth
- Production: Reth (Rust, 3-5x faster than Geth)
- Localnet: op-geth (faster startup)
- Handles tx execution, state, JSON-RPC

### Consensus: OP-Node + Flashblocks
- Derives L3 blocks from Base batches
- 200ms pre-confirmations (Flashblocks)
- 2s full block time

### Batcher: op-batcher
- Collects ~100 blocks of txs
- Posts to EigenDA (or calldata fallback)
- ~10 min batch interval

### Proposer: op-proposer
- Posts state roots to Base hourly
- Enables withdrawals after 7-day challenge

### Challenger: op-challenger
- Monitors for invalid state
- Permissionless - anyone can run
- Submits fraud proofs if needed

## Transaction Flow

```
User tx → Sequencer (200ms Flashblock) → Block (2s) → Batch (10min) → State root (1hr) → Base settlement (7d) → Ethereum finality
```

## EigenDA

Data availability layer, not settlement. 90% cheaper than calldata.

```typescript
if (eigenDA.available) {
  await eigenDA.post(batch);
} else {
  await base.postCalldata(batch);  // Fallback
}
```

## Security

- Fraud proofs: Anyone can challenge invalid state
- Challenge period: 7 days on Base
- Data availability: EigenDA + calldata fallback
- Result: Ethereum-level security

Trust: Ethereum L1 + Base security + 1 honest challenger.

## Performance

| Metric | Value |
|--------|-------|
| Pre-confirmation | 200ms |
| Block time | 2s |
| Batch interval | ~10 min |
| State root | ~1 hr |
| Challenge period | 7 days |
| Gas limit | 30M/block |

## Fee Structure

```
Total = Execution Fee + L1 Data Fee

Execution = Gas Used × Gas Price → Sequencer
L1 Data = Bytes × Base Gas Price → Settlement costs
```

Fee vaults:
- `0x4200...0011` - Sequencer fees
- `0x4200...0019` - Base fees
- `0x4200...001A` - L1 data fees
