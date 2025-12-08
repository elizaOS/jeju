# Mainnet Deployment

Deploy Jeju on Base mainnet.

## Overview

- Settlement: Base (8453)
- Jeju Mainnet: Chain ID 420691
- Time: 1-2 days

## Pre-requisites

- Full security audit
- Bug bounty live
- Insurance
- 24/7 ops team
- See [Prerequisites](./prerequisites)

## Steps

### 1. Deploy Infrastructure

```bash
cd terraform/environments/mainnet
terraform init
terraform apply
```

### 2. Deploy Contracts

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_KEY \
  --broadcast --verify
```

### 3. Update Config

Update `packages/config/chain/mainnet.json` with deployed addresses.

### 4. Deploy Services

```bash
cd kubernetes/helmfile
helmfile -e mainnet sync
```

### 5. Monitor 24h

Before announcing:
- [ ] Block production stable
- [ ] Settlement working
- [ ] RPC responsive
- [ ] Monitoring active
- [ ] No errors in logs

## Security Checklist

- [ ] Audit complete
- [ ] Bug bounty active
- [ ] Multisig configured
- [ ] Emergency runbooks ready
- [ ] 24/7 on-call ready

## Resources

- [Prerequisites](./prerequisites)
- [Monitoring](./monitoring)
- [Runbooks](./runbooks)
