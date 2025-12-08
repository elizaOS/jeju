# Oracle Architecture Decision

**Decision**: Multi-bot price updater for launch

## Comparison

| Criteria | Multi-Bot | Cross-Chain |
|----------|-----------|-------------|
| Cost | $5-20/mo | $260-500/mo |
| Latency | 5 min | 1-2 min |
| Decentralization | Low | High |
| Complexity | Low | High |
| Ready | ✅ Now | 2-3 weeks |

## Why Multi-Bot

1. **50x cheaper** ($5 vs $260/month)
2. **Production ready now**
3. **Easier to debug**
4. **Lower risk**

## Security Mitigations

- 2-3 bots with leader election + failover
- Bot can only update oracle (no admin functions)
- 50% max deviation enforced on-chain
- Paymaster pauses if price stale >1 hour
- All code open source, all txs auditable

## Migration Path

After 6+ months, if needed:
1. Deploy PriceSource on Base
2. Deploy CrossChainPriceRelay on Jeju
3. Test in parallel 1 month
4. Migrate, keep bot as backup

## Production Setup

**Primary**: AWS t3.small ($15/mo)  
**Backup**: Hetzner CX11 ($5/mo)

See [Oracle Setup](../deployment/oracle-setup) for deployment.
