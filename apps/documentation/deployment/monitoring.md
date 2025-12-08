# Monitoring

## Setup

```bash
helm install prometheus ./monitoring/prometheus/
helm install grafana ./monitoring/grafana/

kubectl port-forward -n monitoring svc/prometheus 9090:9090
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Grafana: admin/admin
```

## Key Metrics

- **Chain**: Block rate, tx throughput, gas prices
- **Sequencer**: Uptime, tx pool size, peer count
- **Batcher**: Submission rate, gas costs, EigenDA health
- **Proposer**: State root submissions, gas costs

## Alerts

```yaml
# prometheus/alerts.yml
- alert: SequencerDown
  expr: up{job="sequencer"} == 0
  for: 1m
  
- alert: BatcherFailing
  expr: batcher_failed_batches > 3
  for: 5m
  
- alert: HighGasPrice
  expr: base_gas_price_gwei > 100
  for: 15m
```

Channels: Discord webhooks, Telegram, PagerDuty

## Dashboards

Import from `monitoring/grafana/dashboards/`:
- `op-stack.json`
- `subsquid-overview.json`
