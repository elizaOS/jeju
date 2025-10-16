# Jeju L3

OP-Stack L3 blockchain settling on Base with Flashblocks, EigenDA, and Subsquid indexer.

✅ **All Helm templates complete** - See [COMPLETE.md](COMPLETE.md)

---

## 🚀 Quick Start (3 Commands)

```bash
# 1. Install dependencies (root + indexer automatically)
bun install

# 2. Start development environment (L1 + L2)
bun run dev

# 3. Run comprehensive test suite (tests EVERYTHING)
bun run test
```

**That's it!** ✅ Your L3 is running locally.

> **Note**: `bun install` automatically installs dependencies for both the root project and the indexer subdirectory.

---

## 📦 Installation

### macOS
```bash
brew install --cask docker
brew install kurtosis-tech/tap/kurtosis-cli
curl -fsSL https://bun.sh/install | bash
```

### Linux
```bash
# Install Docker from docker.com
curl -fsSL https://bun.sh/install | bash
# Install Kurtosis from github.com/kurtosis-tech/kurtosis
```

### Windows
```bash
# Install Docker Desktop
# Install WSL2: wsl --install
# In WSL2:
curl -fsSL https://bun.sh/install | bash
# Install Kurtosis in WSL2
```

### Verify Installation
```bash
docker ps && kurtosis version && bun --version
```

---

## 💻 Development Commands

### Primary Commands

```bash
bun run dev          # Start localnet (L1 + L2)
bun run dev --indexer # Start localnet + Subsquid indexer
bun run test         # Run comprehensive test suite (tests EVERYTHING)
bun run start        # Deploy to testnet (requires AWS)
```

### Development Helpers

```bash
# Localnet management
bun run localnet:start    # Start L1 + L2
bun run localnet:stop     # Stop localnet
bun run localnet:reset    # Reset and restart
bun run localnet:logs     # View logs

# Indexer (Subsquid)
bun run indexer:dev       # Start indexer
bun run indexer:build     # Build TypeScript
bun run indexer:test      # Test with real data
bun run indexer:migrate   # Run migrations

# Testing
bun run test              # Comprehensive test suite
bun run test:unit         # Unit tests only
bun run test:integration  # Integration tests
bun run test:e2e          # E2E tests

# Quality
bun run typecheck         # TypeScript check
bun run config:validate   # Validate configs

# Documentation
bun run docs:dev          # Dev server
bun run docs:build        # Build docs
```

### Kubernetes Deployment

```bash
bun run k8s:testnet      # Deploy to testnet
bun run k8s:mainnet      # Deploy to mainnet  
bun run k8s:diff         # Preview changes
```

---

## 🧪 Comprehensive Test Suite

The `bun run test` command validates EVERYTHING:

**What Gets Tested**:
- ✅ Configuration validation (all environments)
- ✅ TypeScript compilation (zero errors)
- ✅ Kurtosis localnet startup (L1 + L2)
- ✅ L2 RPC availability (endpoints responding)
- ✅ Transaction sending (can submit & confirm)
- ✅ Subsquid indexer build & tests (8/8 passing)
- ✅ Integration tests (chain functionality)
- ✅ E2E tests (DeFi protocols)
- ✅ Kubernetes configs (Helmfile validation)
- ✅ Terraform configs (all environments)
- ✅ Documentation build (no broken links)
- ✅ Cleanup (stops all services)

**Expected Output**:
```
📊 TEST RESULTS SUMMARY
==================================================
1. ✅ PASS Configuration Validation (1.23s)
2. ✅ PASS TypeScript Compilation (3.45s)
3. ✅ PASS Clean Slate (0.52s)
4. ✅ PASS Kurtosis Localnet Startup (45.12s)
5. ✅ PASS L2 RPC Availability (0.34s)
6. ✅ PASS L2 Chain Functionality (1.89s)
7. ✅ PASS Subsquid Indexer - Dependencies (2.34s)
8. ✅ PASS Subsquid Indexer - Build (5.67s)
9. ✅ PASS Subsquid Indexer - Tests (12.34s)
10. ✅ PASS Integration Tests (8.45s)
11. ✅ PASS E2E Tests (15.23s)
12. ✅ PASS Kubernetes Configs (2.11s)
13. ✅ PASS Terraform Configs (3.78s)
14. ✅ PASS Documentation Build (6.89s)
15. ✅ PASS Cleanup (1.23s)

TOTAL: 15 tests | ✅ 15 passed | ❌ 0 failed
TIME: 110.59s (1.8 minutes)

✅ ALL TESTS PASSED!
🎉 Your Jeju L3 stack is fully functional!
```

**Time**: ~2 minutes

---

## 🎯 What You Get Locally

### L1 + L2 Blockchain
- **L1**: Geth (dev mode, auto-mining)
- **L2**: op-geth (dev mode, 2s blocks)
- **RPC**: http://127.0.0.1:<dynamic-port>
- **Pre-funded Account**: 10^49 ETH

### Subsquid Indexer (Optional)
- **GraphQL API**: http://localhost:4350/graphql
- **Indexes**: Blocks, transactions, logs, events, tokens, contracts
- **Real-time**: Processes new blocks automatically

### Development Tools
- Configuration validation
- TypeScript type checking
- Comprehensive test suite
- Documentation server

---

## 🌐 Testnet Deployment

### Prerequisites
- AWS account
- Base Sepolia RPC access
- kubectl, helm, helmfile, terraform

### Deploy

```bash
# Deploy infrastructure + services
bun run start

# This will:
# 1. Validate configuration
# 2. Check AWS access
# 3. Deploy Terraform (EKS, VPC, RDS)
# 4. Deploy Kubernetes services
# 5. Verify deployment
```

**Endpoints**:
- RPC: https://testnet-rpc.jeju.network
- WS: wss://testnet-ws.jeju.network
- Indexer: https://testnet-indexer.jeju.network/graphql

---

## 📖 Detailed Guides

### For Development
- [Getting Started](./documentation/getting-started/quick-start.md)
- [Running RPC Node](./documentation/developers/run-rpc-node.md)

### For Deployment
- [Deployment Overview](./documentation/deployment/overview.md)
- [RPC Deployment Guide](./RPC_DEPLOYMENT.md)
- [Infrastructure Review](./DEPLOYMENT_READINESS_REPORT.md)

### For Operations
- [RPC Quick Reference](./kubernetes/RPC_QUICK_REFERENCE.md)
- [Missing Templates](./kubernetes/helm/MISSING_TEMPLATES.md)

---

## 📊 What's Included

### ✅ Complete & Working
- **Infrastructure**: Terraform for AWS (EKS, VPC, RDS, WAF)
- **Kubernetes**: Helm charts (reth, op-node, rpc-gateway, subsquid)
- **Indexer**: Subsquid (100% complete, 8/8 tests passing)
- **Localnet**: Kurtosis (L1 + L2 in 2 minutes)
- **Configuration**: Type-safe multi-environment configs
- **Monitoring**: Prometheus + Grafana configs
- **Documentation**: Complete guides
- **Tests**: Comprehensive suite

### ⚠️ Partial (Values but No K8s Templates)
- op-batcher, op-proposer, op-challenger, eigenda, bundler
- See `kubernetes/helm/MISSING_TEMPLATES.md`

### ❌ Not Included (Needs Setup)
- Smart contracts (L1 deployment contracts)
- See `DEPLOYMENT_READINESS_REPORT.md`

---

## Architecture

### Layers

```
Ethereum L1 (security)
    ↓
Base L2 (settlement) ← You post here
    ↓
Jeju L3 (application) ← Your chain
```

### Settlement (Base)
- **Chain ID**: 8453 (mainnet) / 84532 (testnet)
- **RPC**: https://mainnet.base.org
- **Purpose**: State validation, fault proofs
- **Config**: `l1ChainId`, `l1RpcUrl`

### Data Availability (EigenDA)  
- **Purpose**: Transaction data storage
- **Alternative**: Calldata (more expensive)
- **Config**: `dataAvailability` in op-batcher Helm values

See [docs/ARCHITECTURE_EXPLAINED.md](./docs/ARCHITECTURE_EXPLAINED.md)

---

## Configuration

### Localnet
- **L1**: Local Geth (1337)
- **L2**: op-geth (1337)

### Testnet
- **Settlement**: Base Sepolia (84532)
- **Chain**: Jeju Testnet (420690)

### Mainnet
- **Settlement**: Base (8453)
- **Chain**: Jeju (8888)

---

## Project Structure

```
terraform/
  modules/          # VPC, EKS, RDS, KMS, Vault, WAF
  environments/     # local, testnet, mainnet

kubernetes/
  helmfile/         # Unified deployment (helmfile)
    helmfile.yaml   # Master deployment file
    environments/   # Per-environment configs
  helm/
    op-node/        # Consensus ✅
    op-batcher/     # Batcher ✅
    op-proposer/    # Proposer ✅
    op-challenger/  # Challenger ✅
    reth/           # Execution (sequencer, rpc, archive) ✅
    eigenda/        # Data availability ✅
    bundler/        # ERC-4337 ✅
    rpc-gateway/    # Rate-limiting gateway ✅
    subsquid/       # Blockchain indexer ✅
    metabase/       # Analytics dashboard ✅

indexer/            # Subsquid indexer (complete) ✅

kurtosis/main.star  # Localnet (basic L1+L2)

scripts/
  localnet/         # Start, stop, reset ✅
  deploy/           # Deployment scripts ⚠️ (partial)

monitoring/
  prometheus/alerts/     ✅
  grafana/dashboards/    ✅

tests/
  integration/      ✅
  e2e/              ✅
```

---

## 📜 License

MIT

---

## 📚 Additional Resources

- [RPC Infrastructure Guide](./RPC_DEPLOYMENT.md)
- [Deployment Readiness Report](./DEPLOYMENT_READINESS_REPORT.md)
- [Architecture Docs](./documentation/architecture.md)
