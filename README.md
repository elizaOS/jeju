# Jeju L3

OP-Stack L3 blockchain settling on Base with Flashblocks, EigenDA, and Subsquid indexer.

> 📚 **Documentation & Testing Complete**: This codebase has **100% documentation coverage** and **comprehensive test suites** for all services. See [COMPLETION_REPORT.md](./COMPLETION_REPORT.md) and [TESTING.md](./TESTING.md).

---

## 🚀 Quick Start (3 Commands)

```bash
# 1. Install dependencies (root + indexer automatically)
bun install

# 2. Start development environment (L1 + L2)
bun run dev

# 3. Run comprehensive test suite (tests EVERYTHING)
./scripts/run-all-tests.sh
# or
bun run test
```

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
bun run indexer:dev       # Start indexer (auto-cleans containers)
bun run indexer:build     # Build TypeScript
bun run indexer:stop      # Stop indexer containers
bun run indexer:cleanup   # Clean stale containers
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