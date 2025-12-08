# Oracle Pricing Strategy

Paymaster needs elizaOS/ETH rates. elizaOS trades on Base, paymaster runs on Jeju.

## Options

| Option | Cost | Setup | Availability |
|--------|------|-------|--------------|
| **Price Bot** ⭐ | ~$5/mo | 30 min | ✅ Now |
| Cross-Chain Oracle | Medium | 2-3 days | ✅ Now |
| Chainlink on Jeju | Very high | N/A | ❌ No |
| Superchain Oracle | TBD | N/A | ❌ Future |

## Recommended: Price Bot

Off-chain bot reads prices from Base (Chainlink + Uniswap), updates ManualPriceOracle on Jeju every 5 minutes.

```bash
# Deploy
cd contracts && forge script script/DeployLiquiditySystem.s.sol --broadcast

# Configure
cp .env.oracle.example .env.oracle

# Run
bun run scripts/oracle-updater.ts
```

**Risk mitigation**:
- Run 2-3 redundant bots
- Paymaster auto-pauses if price stale (>1 hour)
- 50% max deviation limit
- Bot is low-privilege (can only update oracle)

## Price Sources

**ETH/USD**: Chainlink on Base (`0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`)  
**elizaOS/USD**: DEX aggregation (Uniswap V3, Aerodrome)

## Migration Path

1. **Launch**: Price bot (simple, cheap, reliable)
2. **Scale (TVL >$10M)**: Cross-chain oracle for decentralization
3. **Future**: Superchain oracle when available

See [Oracle Setup](../deployment/oracle-setup) for implementation.
