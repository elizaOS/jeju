# Jeju Node Operator Rewards System

Incentivize and reward node operators for running reliable Jeju infrastructure.

## Overview

Node operators earn JEJU tokens based on:
- **Uptime** (99%+ = higher multiplier)
- **Request volume** (more requests = more rewards)
- **Geographic diversity** (+50% bonus for underserved regions)
- **Response time** (faster = better scores)

## Components

### Smart Contract
**Location:** `contracts/src/node-rewards/NodeOperatorRewards.sol`

**Features:**
- Stake 1,000 JEJU tokens to register
- Monthly reward periods
- Performance-based rewards
- Slashing for misbehavior
- Geographic diversity incentives

### Rewards Oracle
**Location:** `scripts/rewards/rewards-oracle.ts`

**Features:**
- Fetches performance data from node explorer
- Calculates uptime scores
- Submits on-chain updates
- Automated period management

## Deployment

### 1. Deploy Smart Contract

```bash
cd contracts

# Deploy to testnet
forge script script/DeployRewards.s.sol \
  --rpc-url https://testnet-rpc.jeju.network \
  --broadcast \
  --verify

# Deploy to mainnet
export JEJU_TOKEN_ADDRESS=0x...  # Existing token
forge script script/DeployRewards.s.sol \
  --rpc-url https://rpc.jeju.network \
  --broadcast \
  --verify
```

### 2. Start Rewards Oracle

```bash
# Configure
export REWARDS_CONTRACT=0x...
export ORACLE_PRIVATE_KEY=0x...
export NODE_EXPLORER_API=https://nodes.jeju.network/api

# Run
bun run rewards:oracle

# Or with PM2
pm2 start scripts/rewards/rewards-oracle.ts --name jeju-rewards-oracle

# Or with Docker
docker build -f scripts/rewards/Dockerfile.rewards -t jeju-rewards-oracle .
docker run -d --env-file .env.rewards jeju-rewards-oracle
```

## Economics

### Base Formula

```
Monthly Reward = BaseReward × UptimeMultiplier + VolumeBonus + GeoBonus

Where:
  BaseReward = 100 JEJU
  UptimeMultiplier = 0.5x to 2.0x (based on 99%+ uptime)
  VolumeBonus = (Requests / 1000) × 0.01 JEJU
  GeoBonus = BaseReward × 50% (if underserved region)
```

### Example Calculations

**Scenario 1: Average Node**
```
Uptime: 99.0% (1.0x multiplier)
Requests: 500K/month
Region: North America (not underserved)

Base: 100 JEJU × 1.0 = 100 JEJU
Volume: 500 × 0.01 = 5 JEJU
Geo: 0 JEJU
Total: 105 JEJU/month
```

**Scenario 2: High-Performance Node**
```
Uptime: 99.8% (1.8x multiplier)
Requests: 2M/month
Region: South America (underserved, +50%)

Base: 100 JEJU × 1.8 = 180 JEJU
Volume: 2000 × 0.01 = 20 JEJU
Geo: 180 × 0.5 = 90 JEJU
Total: 290 JEJU/month
```

**Scenario 3: Low-Uptime Node**
```
Uptime: 95.0% (0.6x multiplier)
Requests: 100K/month
Region: Europe (not underserved)

Base: 100 JEJU × 0.6 = 60 JEJU
Volume: 100 × 0.01 = 1 JEJU
Geo: 0 JEJU
Total: 61 JEJU/month
```

## For Node Operators

### Registration

1. **Stake Tokens:**
```bash
# Approve tokens
cast send $JEJU_TOKEN "approve(address,uint256)" \
  $REWARDS_CONTRACT 1000000000000000000000 \
  --rpc-url https://rpc.jeju.network \
  --private-key $YOUR_PRIVATE_KEY

# Register node
cast send $REWARDS_CONTRACT \
  "registerNode(string,string,uint256)" \
  "https://your-rpc.com" \
  "Your Region" \
  1000000000000000000000 \
  --rpc-url https://rpc.jeju.network \
  --private-key $YOUR_PRIVATE_KEY
```

2. **Enable Heartbeats:**
```bash
export NODE_ID=<your-node-id>
export OPERATOR_PRIVATE_KEY=<your-private-key>
bun run heartbeat:start &
```

### Claiming Rewards

```bash
# Check pending rewards
cast call $REWARDS_CONTRACT \
  "calculateRewards(bytes32)" \
  $YOUR_NODE_ID \
  --rpc-url https://rpc.jeju.network

# Claim rewards (minimum 24h between claims)
cast send $REWARDS_CONTRACT \
  "claimRewards(bytes32)" \
  $YOUR_NODE_ID \
  --rpc-url https://rpc.jeju.network \
  --private-key $YOUR_PRIVATE_KEY
```

### Monitoring Performance

Visit https://nodes.jeju.network/nodes/YOUR_NODE_ID to track:
- Uptime score
- Request volume
- Response time
- Pending rewards

## Configuration Parameters

Can be updated by contract owner:

| Parameter | Current Value | Adjustable |
|-----------|---------------|------------|
| Min Stake | 1,000 JEJU | ✅ Yes (owner) |
| Base Reward | 100 JEJU/month | ✅ Yes (owner) |
| Uptime Threshold | 99.00% | ✅ Yes (owner) |
| Uptime Min Multiplier | 0.5x | ✅ Yes (owner) |
| Uptime Max Multiplier | 2.0x | ✅ Yes (owner) |
| Geographic Bonus | 50% | ✅ Yes (owner) |
| Volume Bonus Rate | 0.01 JEJU/1K | ✅ Yes (owner) |

## Slashing

Operators can be slashed for:
- Extended downtime (>7 days)
- Fraudulent performance reporting
- Network attacks
- Terms of service violations

Slashing percentage determined case-by-case (up to 100% of stake).

## Support

- **Operator Handbook:** `documentation/operators/node-operator-handbook.md`
- **Discord:** https://discord.gg/jeju (#node-rewards)
- **GitHub:** https://github.com/jeju-l3/jeju/issues

