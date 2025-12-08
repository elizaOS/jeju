# DeFi Protocols

## Uniswap V4

Singleton architecture with custom hooks.

**Deploy**:
```bash
bun run scripts/deploy-uniswap-v4.ts
```

**Localnet**:
```typescript
PoolManager: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
WETH: '0x4200000000000000000000000000000000000006'
```

Docs: https://docs.uniswap.org/contracts/v4/overview

## Paymaster Integration

Gasless transactions with elizaOS tokens:

```solidity
contract MyDeFiApp {
    address public revenueWallet;
    
    function swap(...) external {
        // Revenue credited to revenueWallet when users pay gas via paymaster
    }
}
```

See [Contract Addresses](/contracts) for deployed addresses.
