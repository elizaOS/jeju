# Monitoring

Prometheus + Grafana observability stack.

**URL**: http://localhost:4010 (Grafana)  
**Credentials**: admin / admin

## Start

```bash
cd apps/monitoring
./start-monitoring.sh
```

## Dashboards

1. **Jeju Overview** - High-level health
2. **Blockchain Activity** - Blocks, txs, gas
3. **Events Explorer** - On-chain events
4. **Contracts & DeFi** - Contract deployments
5. **Prediction Markets** - Trading volume
6. **Accounts & Tokens** - User activity
7. **OP Stack** - Chain infrastructure
8. **Indexer** - Subsquid health

## Data Sources

- **Prometheus** (9090): OP Stack metrics
- **PostgreSQL**: Indexed blockchain data

## Alert Rules

Located in `prometheus/alerts/`:

```yaml
# chain.yaml
- alert: SequencerDown
  expr: up{job="sequencer"} == 0
  for: 1m
  severity: critical

# rpc.yaml
- alert: RPCHighLatency
  expr: rpc_latency_seconds > 1
  for: 5m
  severity: warning
```

## Resources

- ~500MB RAM total
- 1GB disk/week (metrics)
- 15 day retention (configurable)
