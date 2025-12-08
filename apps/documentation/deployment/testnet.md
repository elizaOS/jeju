# Testnet Deployment

Deploy Jeju on Base Sepolia.

## Overview

- Settlement: Base Sepolia (84532)
- Jeju Testnet: Chain ID 420690
- Time: 2-4 hours

## Steps

### 1. Infrastructure

```bash
cd terraform/environments/testnet
terraform init
terraform apply
```

### 2. Deploy Contracts

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_KEY \
  --broadcast --verify
```

### 3. Update Config

Update `packages/config/chain/testnet.json` with deployed addresses.

### 4. Deploy Services

```bash
cd kubernetes/helmfile
helmfile -e testnet sync
```

### 5. Verify

```bash
cast block latest --rpc-url https://testnet-rpc.jeju.network
```

## Resources

- [Prerequisites](./prerequisites)
- [Monitoring](./monitoring)
