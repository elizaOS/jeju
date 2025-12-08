# Bridge

**Testnet**: https://testnet-bridge.jeju.network  
**Mainnet**: https://bridge.jeju.network

## Deposit (Base → Jeju)

Time: ~2 minutes  
Fee: Gas only

1. Connect wallet on Base
2. Enter amount
3. Confirm tx
4. Wait ~2 min

## Withdrawal (Jeju → Base)

**Standard**: 7 days (challenge period)  
**Fast**: ~15 min via Hop/Across

### Standard

1. Initiate withdrawal on Jeju
2. Wait 7 days
3. Prove withdrawal on Base
4. Finalize and claim

### Fast Bridges

- [Hop Protocol](https://hop.exchange)
- [Across](https://across.to)

Small fee for instant liquidity.

## Supported Assets

- **ETH**: Native on all chains
- **ERC-20**: Bridge via L1StandardBridge
- **NFTs**: Coming soon

## Programmatic

```typescript
import { CrossChainMessenger } from '@eth-optimism/sdk';

const messenger = new CrossChainMessenger({
  l1ChainId: 8453,  // Base
  l2ChainId: 420691, // Jeju
  l1SignerOrProvider: baseSigner,
  l2SignerOrProvider: jejuSigner,
  bedrock: true,
});

// Deposit
await messenger.depositETH(ethers.parseEther('0.1'));

// Withdraw (then wait 7 days, prove, finalize)
await messenger.withdrawETH(ethers.parseEther('0.1'));
```

## Security

- Use only official bridge
- Double-check addresses
- Test with small amounts first
- Transactions are irreversible
