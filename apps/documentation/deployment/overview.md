# Deployment

## Options

| Environment | Time | Use Case |
|-------------|------|----------|
| [Localnet](/getting-started/quick-start) | 10 min | Development |
| [Testnet](./testnet) | 2-4 hrs | Public testing |
| [Mainnet](./mainnet) | 1-2 days | Production |

## Should You Deploy?

Self-deploy only if you:
- Need your own L3 instance
- Have 24/7 ops capability
- Have budget for infrastructure + audits

Otherwise: Just build on public Jeju.

## Components

```
AWS EKS
├── op-node (consensus)
├── reth (execution)
├── op-batcher
├── op-proposer
└── monitoring

Base (settlement layer)
├── OptimismPortal
├── L2OutputOracle
├── L1StandardBridge
└── SystemConfig

EigenDA (data availability)
```

## Process

1. **Infrastructure** (Terraform): VPC, EKS, RDS
2. **Contracts** (Foundry): Deploy L1 contracts to Base
3. **Services** (Helm): Deploy OP Stack
4. **Validation**: Test blocks, deposits, withdrawals

## Before Mainnet

- [ ] Full audit ($50k-200k)
- [ ] Bug bounty live
- [ ] Multisig configured
- [ ] Emergency runbooks
- [ ] 24/7 on-call team
- [ ] Testnet stable 4+ weeks
