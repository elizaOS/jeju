# Uniswap V4 Pool Initialization

## Prerequisites

- PoolManager deployed
- PositionManager deployed (required - direct PoolManager calls revert)
- Token addresses sorted (`token0 < token1`)

## Unlock Pattern

V4 uses unlock pattern for gas efficiency:

```
User → PositionManager → PoolManager.unlock() → callback → initialize()
```

Direct `PoolManager.initialize()` reverts. Use `PositionManager.initialize()`.

## Deploy PositionManager

```bash
cd contracts
forge install Uniswap/v4-periphery
```

```solidity
PositionManager positionManager = new PositionManager(IPoolManager(poolManager));
```

## Initialize Pool (Forge Script)

```solidity
PoolKey memory key = PoolKey({
    currency0: Currency.wrap(token0),  // Lower address
    currency1: Currency.wrap(token1),  // Higher address
    fee: 3000,                         // 0.3%
    tickSpacing: 60,
    hooks: IHooks(address(0))
});

// Initial price: sqrt(price) * 2^96
uint160 sqrtPriceX96 = 792281625142643375935439503;  // 1:10000 ratio

PositionManager(positionManager).initialize(key, sqrtPriceX96, "");
```

## sqrtPriceX96 Calculation

```typescript
function calculateSqrtPriceX96(price: number): bigint {
    const sqrtPrice = Math.sqrt(price);
    const Q96 = BigInt(2) ** BigInt(96);
    return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

// 1 elizaOS = 0.0001 ETH
calculateSqrtPriceX96(0.0001); // 792281625142643375935439503n
```

## Fee Tiers

| Fee | Tick Spacing | Use |
|-----|--------------|-----|
| 500 (0.05%) | 10 | Stablecoins |
| 3000 (0.3%) | 60 | Most pairs |
| 10000 (1%) | 200 | Volatile |

## Errors

- **"Pool is locked"**: Use PositionManager, not PoolManager
- **"Currencies out of order"**: Sort addresses: `[a, b] = a < b ? [a, b] : [b, a]`
- **"Invalid tick spacing"**: Match tick spacing to fee tier

## Resources

- [Uniswap V4 Docs](https://docs.uniswap.org/contracts/v4/overview)
- [V4 Periphery](https://github.com/Uniswap/v4-periphery)
