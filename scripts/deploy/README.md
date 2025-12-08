# Jeju AWS Deployment Scripts

Complete deployment orchestration for AWS testnet and mainnet environments.

## Quick Start

```bash
# 1. Configure AWS credentials
aws configure

# 2. Copy and configure environment
cp .env.testnet.example .env.testnet
# Edit .env.testnet with your values

# 3. Deploy everything
./scripts/deploy/deploy-testnet.sh

# 4. Destroy when done testing
./scripts/deploy/destroy-testnet.sh
```

## Scripts

### `deploy-testnet.sh`
Complete end-to-end deployment:
- ✅ Pre-flight checks (AWS auth, tools, env vars)
- ✅ Terraform infrastructure (EKS, RDS, networking)
- ✅ Docker image builds and ECR push
- ✅ Smart contract deployment (Foundry)
- ✅ Kubernetes application deployment (Helmfile)
- ✅ Post-deployment verification

**Environment Variables:**
- `SKIP_TERRAFORM=true` - Skip infrastructure deployment
- `SKIP_CONTRACTS=true` - Skip contract deployment  
- `SKIP_APPS=true` - Skip application deployment
- `SKIP_VERIFICATION=true` - Skip verification tests

```bash
# Deploy only apps (infrastructure already exists)
SKIP_TERRAFORM=true SKIP_CONTRACTS=true ./scripts/deploy/deploy-testnet.sh
```

### `build-and-push-images.sh`
Build and push all Docker images to ECR:
- Builds all app Dockerfiles
- Tags with git SHA and environment
- Pushes to ECR registry

```bash
./scripts/deploy/build-and-push-images.sh testnet
```

### `destroy-testnet.sh`
Complete infrastructure teardown:
- Removes all Kubernetes resources
- Empties S3 buckets
- Destroys Terraform infrastructure
- Cleans up local state

```bash
./scripts/deploy/destroy-testnet.sh
```

## Deployment Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Pre-flight Checks                                    │
│    - Verify AWS credentials                             │
│    - Check required tools (terraform, helm, kubectl)    │
│    - Validate .env.testnet configuration                │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Deploy Infrastructure (Terraform)                    │
│    - VPC, subnets, NAT gateways                         │
│    - EKS cluster with node groups                       │
│    - RDS PostgreSQL databases                           │
│    - S3 buckets + CloudFront distributions              │
│    - ECR repositories                                   │
│    - ALB + security groups                              │
│    - KMS encryption keys                                │
│    - IAM roles and policies                             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Build & Push Images                                  │
│    - Build Docker images for all apps                   │
│    - Tag with git SHA and 'testnet-latest'              │
│    - Push to ECR registry                               │
│    - Update Helm values with image tags                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Deploy Smart Contracts (Foundry)                     │
│    - Deploy liquidity system (paymaster, vault, oracle) │
│    - Deploy ERC-8004 registries (identity, reputation)  │
│    - Deploy game tokens (Gold, Items)                   │
│    - Deploy prediction markets (Predimarket)            │
│    - Save deployment addresses                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Deploy Applications (Kubernetes/Helm)                │
│    - Create namespaces and secrets                      │
│    - Deploy infrastructure (reth, op-node, bundler)     │
│    - Deploy apps (bazaar, gateway, leaderboard)         │
│    - Deploy monitoring (prometheus, grafana)            │
│    - Wait for rollout completion                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Verify Deployment                                    │
│    - Check pod health                                   │
│    - Test RPC endpoints                                 │
│    - Verify contract deployment                         │
│    - Run smoke tests                                    │
│    - Check monitoring dashboards                        │
└─────────────────────────────────────────────────────────┘
```

## Cost Estimation

**AWS Testnet (Monthly):**
- EKS Control Plane: ~$73
- EC2 Nodes (3x t3.large): ~$150
- RDS (db.t3.medium): ~$60
- Data Transfer: ~$50
- EBS Storage: ~$30
- **Total: ~$363/month**

**Scaling Options:**
- Min replicas: ~$300/month
- Max replicas (under load): ~$800/month

## Troubleshooting

### "AWS credentials not found"
```bash
aws configure
# Enter your credentials
```

### "EKS cluster not found"
```bash
# Re-run terraform
cd terraform/environments/testnet
terraform apply
```

### "Image pull errors"
```bash
# Re-push images
./scripts/deploy/build-and-push-images.sh testnet
```

### "Database connection failed"
```bash
# Check RDS endpoint
cd terraform/environments/testnet
terraform output rds_endpoint

# Update .env.testnet with correct endpoint
```

## Manual Steps

If you need to perform steps manually:

```bash
# 1. Infrastructure
cd terraform/environments/testnet
terraform init
terraform apply

# 2. Images
./scripts/deploy/build-and-push-images.sh testnet

# 3. Contracts
cd contracts
forge script script/DeployLiquiditySystem.s.sol --broadcast --rpc-url $JEJU_RPC_URL

# 4. Apps
cd kubernetes/helmfile
helmfile -e testnet sync

# 5. Verify
bun run scripts/verify-cloud-deployment.ts
```

## Security Notes

1. **Never commit `.env.testnet`** - contains private keys
2. **Use AWS Secrets Manager** for production secrets
3. **Enable MFA** on AWS account
4. **Rotate keys regularly** (90 days)
5. **Monitor costs** with AWS Cost Explorer
6. **Enable GuardDuty** for threat detection

## Support

- Documentation: `https://docs.jeju.network/deployment`
- Discord: `https://discord.gg/jeju`
- Issues: `https://github.com/JejuNetwork/jeju/issues`

