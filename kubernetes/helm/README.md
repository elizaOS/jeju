# Jeju L3 Helm Charts

Production-grade Kubernetes deployments for all Jeju infrastructure components.

## Overview

This directory contains Helm charts for deploying Jeju L3 infrastructure on Kubernetes:

### Core Services
- **op-node** - OP-Stack consensus layer with Flashblocks
- **reth** - Execution layer (sequencer, RPC nodes, archive nodes)
- **op-batcher** - Transaction batcher to Base L2
- **op-proposer** - State root proposer to Base L2
- **op-challenger** - Fault proof challenger

### Data Availability
- **eigenda** - EigenDA client for cheap data availability

### Account Abstraction
- **bundler** - ERC-4337 bundler for gasless transactions

### Infrastructure
- **rpc-gateway** - Nginx-based load balancer with rate limiting
- **subsquid** - Blockchain indexer with GraphQL API
- **metabase** - Analytics dashboard

### Ingress & Certificates
- **cert-manager** - Automatic SSL certificate management
- **ingress-nginx** - Ingress controller

## Quick Start

### Prerequisites

```bash
# kubectl configured for your cluster
kubectl cluster-info

# Helm 3+ installed
helm version

# Optional: Helmfile for multi-chart deployment
brew install helmfile  # macOS
```

### Deploy Single Chart

```bash
# Deploy op-node to testnet
helm install op-node ./kubernetes/helm/op-node \
  --namespace op-stack \
  --create-namespace \
  --values ./kubernetes/helm/op-node/values-testnet.yaml

# Check deployment
kubectl get pods -n op-stack
kubectl logs -f deployment/op-node -n op-stack
```

### Deploy Full Stack with Helmfile

```bash
cd kubernetes/helmfile

# Deploy testnet
helmfile -e testnet sync

# Deploy mainnet
helmfile -e mainnet sync

# Check status
helmfile -e testnet status

# View deployed releases
helm list --all-namespaces
```

## Chart Structure

Each chart follows this structure:

```
chart-name/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default values
├── values-mainnet.yaml     # Mainnet overrides
├── values-testnet.yaml     # Testnet overrides
├── values-localnet.yaml    # Localnet overrides
└── templates/
    ├── _helpers.tpl        # Template helpers
    ├── deployment.yaml     # Deployment manifest
    ├── service.yaml        # Service manifest
    ├── configmap.yaml      # Configuration (if needed)
    ├── secret.yaml         # Secrets (if needed)
    ├── pvc.yaml           # Storage (if needed)
    └── hpa.yaml           # Auto-scaling (if enabled)
```

## Environment-Specific Values

### Localnet (Development)
```yaml
# values-localnet.yaml
replicaCount: 1
resources:
  requests:
    cpu: 500m
    memory: 1Gi
persistence:
  enabled: false
autoscaling:
  enabled: false
```

### Testnet (Staging)
```yaml
# values-testnet.yaml
replicaCount: 1-2
resources:
  requests:
    cpu: 1000m
    memory: 2Gi
persistence:
  enabled: true
  size: 500Gi
autoscaling:
  enabled: false
```

### Mainnet (Production)
```yaml
# values-mainnet.yaml
replicaCount: 3-5
resources:
  requests:
    cpu: 2000m
    memory: 4Gi
persistence:
  enabled: true
  size: 1Ti
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 15
```

## Common Operations

### Install

```bash
# Install with default values
helm install <release-name> ./helm/<chart-name>

# Install with environment values
helm install <release-name> ./helm/<chart-name> \
  -f ./helm/<chart-name>/values-mainnet.yaml

# Install in specific namespace
helm install <release-name> ./helm/<chart-name> \
  -n <namespace> \
  --create-namespace
```

### Upgrade

```bash
# Upgrade with new values
helm upgrade <release-name> ./helm/<chart-name> \
  -f ./helm/<chart-name>/values-mainnet.yaml

# Force upgrade
helm upgrade <release-name> ./helm/<chart-name> --force

# Rollback if needed
helm rollback <release-name>
```

### Debugging

```bash
# Test chart rendering
helm template ./helm/<chart-name> \
  -f ./helm/<chart-name>/values-testnet.yaml

# Dry-run install
helm install <release-name> ./helm/<chart-name> --dry-run --debug

# Get release info
helm get values <release-name>
helm get manifest <release-name>
```

### Uninstall

```bash
# Remove release (keeps PVCs)
helm uninstall <release-name>

# Remove release and PVCs
helm uninstall <release-name> -n <namespace>
kubectl delete pvc -n <namespace> --all
```

## Chart Details

### op-node (Consensus Layer)

Runs the OP-Stack rollup node that derives L3 blocks from L2 batches.

**Key Configuration:**
- `config.l1.rpcUrl` - Base RPC endpoint
- `config.network` - Network type (mainnet/testnet)
- `config.p2p.bootnodes` - P2P bootstrapping nodes

**Scaling:**
- Mainnet: 3 replicas for high availability
- Testnet: 1 replica (cost optimization)

### reth (Execution Layer)

Multiple deployment modes:
- `mode: sequencer` - Block production (1 replica only)
- `mode: rpc` - RPC serving (5-15 replicas, auto-scaling)
- `mode: archive` - Historical data (2-5 replicas)

**Key Configuration:**
- `mode` - Deployment mode
- `persistence.size` - Storage size (500GB RPC, 2TB archive)
- `resources` - CPU/memory based on mode

### rpc-gateway (Load Balancer)

Nginx-based gateway with rate limiting and DDoS protection.

**Key Configuration:**
- `rateLimit.requestsPerSecond` - Per-IP rate limit
- `backend.rpcService` - Upstream RPC service
- `ingress.hosts` - Public domains

### subsquid (Indexer)

Blockchain data indexer with GraphQL API.

**Key Configuration:**
- `processor.env.RPC_ETH_HTTP` - Jeju RPC endpoint
- `processor.env.START_BLOCK` - Starting block number
- `postgres.persistence.size` - Database storage

## Security Best Practices

### Secrets Management

❌ **NEVER** commit secrets to values files!

✅ **DO** use external secret managers:

```yaml
# Use Vault annotations
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "op-batcher"
  vault.hashicorp.com/agent-inject-secret-private-key: "secret/data/jeju/mainnet/batcher"
```

### Resource Limits

Always set resource limits to prevent resource exhaustion:

```yaml
resources:
  limits:
    cpu: 2000m
    memory: 4Gi
  requests:
    cpu: 1000m
    memory: 2Gi
```

### Network Policies

Restrict network access between services:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: op-node-policy
spec:
  podSelector:
    matchLabels:
      app: op-node
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
      - podSelector:
          matchLabels:
            app: reth
```

## Monitoring

All charts include Prometheus metrics:

```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "9090"
  prometheus.io/path: "/metrics"
```

### Grafana Dashboards

Import dashboards from `monitoring/grafana/dashboards/`:

```bash
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Open http://localhost:3000
# Import dashboard JSON files
```

## Validation

### Test Chart Syntax

```bash
# Lint all charts
helm lint ./helm/*/

# Validate specific chart
helm template ./helm/op-node -f ./helm/op-node/values-testnet.yaml | kubectl apply --dry-run=client -f -
```

### Run Chart Tests

```bash
# Run validation tests
bun run kubernetes/helm/test-charts.ts

# Or manually test each chart
helm test <release-name>
```

## Cost Estimates

### Testnet (~$500/month)
- op-node: 1 replica = $100
- reth (RPC): 1 replica = $150
- reth (archive): 1 replica = $200
- Infrastructure: $50

### Mainnet (~$6,000/month)
- op-node: 3 replicas = $600
- reth (sequencer): 1 replica = $400
- reth (RPC): 5-15 replicas = $2,000
- reth (archive): 2-5 replicas = $1,500
- op-batcher: 2 replicas = $300
- op-proposer: 2 replicas = $300
- RPC gateway: 3-20 replicas = $400
- Subsquid: $300
- Infrastructure: $200

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n <namespace>

# Check pod logs
kubectl logs <pod-name> -n <namespace>

# Describe pod for events
kubectl describe pod <pod-name> -n <namespace>

# Check resources
kubectl top pods -n <namespace>
```

### Persistent Volume Issues

```bash
# List PVCs
kubectl get pvc -n <namespace>

# Check PVC status
kubectl describe pvc <pvc-name> -n <namespace>

# Check storage class
kubectl get storageclass
```

### Network/Ingress Issues

```bash
# Check ingress
kubectl get ingress -n <namespace>
kubectl describe ingress <ingress-name> -n <namespace>

# Check services
kubectl get svc -n <namespace>

# Test internal connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- sh
# Inside pod:
curl http://reth-rpc.rpc:8545 -X POST -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Support

- **Discord**: [#infrastructure](https://discord.gg/jeju)
- **Documentation**: [Deployment Guide](../../documentation/deployment/overview.md)
- **GitHub Issues**: [Report issues](https://github.com/jeju-l3/jeju/issues)

## Next Steps

- [Deploy Testnet](../../documentation/deployment/testnet.md)
- [Deploy Mainnet](../../documentation/deployment/mainnet.md)
- [Monitoring Setup](../../documentation/deployment/monitoring.md)
- [Runbooks](../../documentation/deployment/runbooks.md)

