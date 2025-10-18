# JejuMarket Indexer Deployment Guide

This guide covers deploying and configuring the Subsquid indexer for JejuMarket prediction markets.

## Overview

The JejuMarket indexer:
- Indexes all market events (creation, trades, resolutions)
- Provides GraphQL API for frontend queries
- Tracks user positions and market statistics
- Integrates with PredictionOracle for game outcomes

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Jeju   │────────>│   Subsquid   │────────>│  PostgreSQL │
│  Blockchain │  Events │   Processor  │  Store  │   Database  │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              │ Serve
                              ▼
                        ┌──────────────┐
                        │   GraphQL    │
                        │   API Server │
                        └──────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │   Frontend   │
                        │ (jeju-market)│
                        └──────────────┘
```

## Prerequisites

### 1. System Requirements

- **Node.js**: v18+ (v20 recommended)
- **Bun**: Latest version (for running scripts)
- **PostgreSQL**: v14+ (can use Docker)
- **Docker**: v20+ (optional, for database)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 50GB minimum (grows with chain data)

### 2. Install Subsquid CLI

```bash
npm install -g @subsquid/cli@latest
```

Verify installation:

```bash
sqd --version
```

### 3. Database Setup

#### Option A: Docker (Recommended for Development)

```bash
cd indexer
sqd up
```

This starts PostgreSQL in Docker with the correct configuration.

#### Option B: Self-Hosted PostgreSQL

Install PostgreSQL and create database:

```bash
# Install PostgreSQL (varies by OS)
# Ubuntu/Debian:
sudo apt-get install postgresql-14

# macOS:
brew install postgresql@14

# Create database
sudo -u postgres psql
CREATE DATABASE indexer;
CREATE USER squid WITH PASSWORD 'squid';
GRANT ALL PRIVILEGES ON DATABASE indexer TO squid;
\q
```

## Configuration

### 1. Environment Variables

Create `.env` file in `/indexer` directory:

```bash
# RPC Configuration
RPC_ETH_HTTP=http://localhost:8545              # Localnet
# RPC_ETH_HTTP=https://testnet-rpc.jeju.network  # Testnet
# RPC_ETH_HTTP=https://rpc.jeju.network          # Mainnet

# Database Configuration
DB_NAME=indexer
DB_HOST=localhost
DB_PORT=5432
DB_USER=squid
DB_PASS=squid

# Start Block (block where contracts were deployed)
START_BLOCK=0                                    # Localnet (start from genesis)
# START_BLOCK=1000000                            # Testnet (set to deployment block)
# START_BLOCK=5000000                            # Mainnet (set to deployment block)

# Contract Addresses (from deployment)
JEJU_MARKET_ADDRESS=0x...
PREDICTION_ORACLE_ADDRESS=0x...

# API Configuration
GQL_PORT=4350

# Logging
SQD_DEBUG=*
```

### 2. Find Start Block

To optimize sync time, set START_BLOCK to the block where contracts were deployed:

```bash
# Get deployment block from deployment file
cat ../deployments/jeju-market-testnet.json | jq '.deploymentBlock'

# Or query the chain for first event
cast block-number --rpc-url $RPC_ETH_HTTP
```

**Important**: Starting from block 0 on mainnet will take a very long time. Always use the deployment block!

### 3. Update Schema (if needed)

The schema is defined in `schema.graphql`. If you modify it:

```bash
# Generate TypeORM entities from schema
sqd codegen

# Generate and apply database migrations
sqd migration:generate
sqd migration:apply
```

### 4. Verify ABI Files

Ensure ABI files are up to date:

```bash
ls -la indexer/abi/
# Should see:
# - JejuMarket.json
# - PredictionOracle.json
```

If ABIs are missing or outdated, copy from contract build artifacts:

```bash
cp contracts/out/JejuMarket.sol/JejuMarket.json indexer/abi/
cp contracts/out/PredictionOracle.sol/PredictionOracle.json indexer/abi/
```

## Deployment Steps

### Local Development

```bash
cd indexer

# 1. Clean up any existing database
npm run db:cleanup

# 2. Start PostgreSQL
npm run db:up

# 3. Create database and run migrations
sleep 3
npm run db:create
npm run db:migrate

# 4. Start processor and API server
npm run dev
```

The indexer will start syncing from START_BLOCK. You can monitor progress in the logs.

**Access GraphQL Playground**: Visit `http://localhost:4350/graphql` in your browser when the indexer is running.

### Testnet Deployment

#### Option 1: Self-Hosted Server

```bash
# 1. Set up production environment
export NODE_ENV=production
export RPC_ETH_HTTP=https://testnet-rpc.jeju.network
export START_BLOCK=1000000  # Set to actual deployment block

# 2. Install dependencies
cd indexer
npm install --production

# 3. Build TypeScript
npm run build

# 4. Run migrations
npm run db:migrate

# 5. Start processor (in background)
nohup npm run process > processor.log 2>&1 &

# 6. Start API server (in background)
nohup npm run api > api.log 2>&1 &

# 7. Monitor logs
tail -f processor.log api.log
```

#### Option 2: Subsquid Cloud (Recommended)

Subsquid Cloud provides managed hosting:

```bash
# 1. Install Subsquid CLI
npm install -g @subsquid/cli

# 2. Login to Subsquid Cloud
sqd auth

# 3. Deploy
sqd deploy .
```

Follow the prompts to configure:
- Choose a name for your squid
- Select region (closest to your RPC)
- Configure environment variables
- Deploy

**Note**: Subsquid Cloud provides:
- Automatic scaling
- Managed PostgreSQL
- Built-in monitoring
- HTTPS endpoints

### Mainnet Deployment

Same as testnet, but:

```bash
export RPC_ETH_HTTP=https://rpc.jeju.network
export START_BLOCK=5000000  # Set to actual deployment block

# Use production-grade PostgreSQL with backups
# Consider using managed PostgreSQL (AWS RDS, DigitalOcean, etc.)
```

**Production Checklist**:
- [ ] Use managed PostgreSQL with automatic backups
- [ ] Set up monitoring and alerting
- [ ] Configure log rotation
- [ ] Use process manager (PM2, systemd)
- [ ] Set up reverse proxy (nginx) with SSL
- [ ] Configure firewall to only allow necessary ports
- [ ] Set up automatic restarts on failure
- [ ] Monitor disk space (database grows over time)

## Monitoring Setup

### 1. Health Checks

Check processor status:

```bash
# Check if processor is running
ps aux | grep "sqd process"

# Check API server
curl http://localhost:4350/graphql

# Check database connection
psql -U squid -d indexer -c "SELECT COUNT(*) FROM prediction_market;"
```

### 2. Sync Status

Monitor sync progress:

```bash
# Check current indexed block
curl -X POST http://localhost:4350/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ squidStatus { height } }"}'

# Compare with chain head
cast block-number --rpc-url $RPC_ETH_HTTP
```

### 3. Query Performance

Test critical queries:

```bash
# Get all markets
curl -X POST http://localhost:4350/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ predictionMarkets(limit: 10) { id question totalVolume } }"}'

# Get market by ID
curl -X POST http://localhost:4350/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ predictionMarketById(id: \"SESSION_ID\") { question yesShares noShares } }"}'
```

### 4. Set Up Monitoring Alerts

Using PM2:

```bash
npm install -g pm2

# Start with PM2
cd indexer
pm2 start npm --name "jeju-indexer-processor" -- run process
pm2 start npm --name "jeju-indexer-api" -- run api

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

Using systemd:

```bash
# Create service file: /etc/systemd/system/jeju-indexer-processor.service
[Unit]
Description=JejuMarket Indexer Processor
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/jeju/indexer
Environment="NODE_ENV=production"
Environment="RPC_ETH_HTTP=https://rpc.jeju.network"
ExecStart=/usr/bin/npm run process
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable jeju-indexer-processor
sudo systemctl start jeju-indexer-processor
sudo systemctl status jeju-indexer-processor
```

### 5. Monitoring Dashboard

Use Grafana + Prometheus for advanced monitoring:

```bash
# Add metrics endpoint to your indexer
# Monitor:
# - Sync lag (chain height - indexed height)
# - Query latency
# - Database size
# - Memory usage
# - Error rate
```

## Troubleshooting

### Processor Not Syncing

```bash
# Check RPC connection
curl $RPC_ETH_HTTP -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check processor logs
tail -f processor.log

# Check database connection
psql -U squid -d indexer -c "\dt"
```

### Database Issues

```bash
# Reset database (WARNING: deletes all data)
npm run db:reset

# Check database size
psql -U squid -d indexer -c "
  SELECT pg_size_pretty(pg_database_size('indexer'));
"

# Vacuum database (reclaim space)
psql -U squid -d indexer -c "VACUUM FULL;"
```

### Missing Events

```bash
# Verify START_BLOCK is set correctly
echo $START_BLOCK

# Check if contracts are indexed
# Look in processor logs for "Processing block X"

# Verify contract addresses
echo $JEJU_MARKET_ADDRESS
echo $PREDICTION_ORACLE_ADDRESS

# Check if events exist on chain
cast logs --from-block $START_BLOCK --address $JEJU_MARKET_ADDRESS --rpc-url $RPC_ETH_HTTP
```

### GraphQL Errors

```bash
# Check API server logs
tail -f api.log

# Test simple query
curl -X POST http://localhost:4350/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { queryType { name } } }"}'

# Rebuild schema
npm run codegen
```

### Out of Sync

If indexer falls behind:

```bash
# Check system resources
htop

# Check disk space
df -h

# Check database queries
psql -U squid -d indexer -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query
  FROM pg_stat_activity
  WHERE state = 'active';
"

# Optimize database
psql -U squid -d indexer -c "ANALYZE;"
```

### Complete Reset

If everything is broken:

```bash
cd indexer

# Stop everything
pm2 stop all  # or: killall node

# Clean up
npm run db:down
rm -rf db/migrations/*

# Start fresh
npm run db:up
sleep 3
npm run db:create
sqd codegen
sqd migration:generate
sqd migration:apply

# Restart
npm run dev
```

## Performance Optimization

### 1. Database Tuning

Edit `postgresql.conf`:

```conf
# Increase memory for better performance
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 64MB

# Optimize for writes
wal_buffers = 16MB
checkpoint_completion_target = 0.9
```

### 2. Indexing Strategy

Add database indexes for common queries:

```sql
-- Index on market resolution status
CREATE INDEX idx_market_resolved ON prediction_market(resolved);

-- Index on trade timestamps
CREATE INDEX idx_trade_timestamp ON market_trade(timestamp DESC);

-- Index on trader addresses
CREATE INDEX idx_position_trader ON market_position(trader_id);
```

### 3. RPC Optimization

- Use a local RPC node if possible (much faster)
- Use Archive RPC for full historical data
- Consider RPC with WebSocket support for faster updates

```bash
# Local node (fastest)
RPC_ETH_HTTP=http://localhost:8545

# Public RPC (slower but no setup)
RPC_ETH_HTTP=https://rpc.jeju.network

# Paid RPC service (fast + reliable)
RPC_ETH_HTTP=https://jeju-mainnet.infura.io/v3/YOUR-KEY
```

## API Usage Examples

### Query Active Markets

```graphql
query {
  predictionMarkets(
    where: { resolved_eq: false }
    orderBy: createdAt_DESC
    limit: 20
  ) {
    id
    sessionId
    question
    liquidityB
    totalVolume
    createdAt
    yesShares
    noShares
  }
}
```

### Get User Positions

```graphql
query {
  marketPositions(
    where: { trader: { address_eq: "0x..." } }
  ) {
    id
    market {
      question
      resolved
      outcome
    }
    yesShares
    noShares
    totalSpent
    totalReceived
    hasClaimed
  }
}
```

### Get Market Trade History

```graphql
query {
  marketTrades(
    where: { market: { sessionId_eq: "0x..." } }
    orderBy: timestamp_DESC
  ) {
    id
    trader { address }
    outcome
    isBuy
    shares
    cost
    priceAfter
    timestamp
  }
}
```

### Get Market Statistics

```graphql
query {
  marketStats(orderBy: date_DESC, limit: 30) {
    date
    marketCount
    totalVolume
    uniqueTraders
    tradeCount
    avgLiquidity
    resolvedMarkets
  }
}
```

## Next Steps

After deploying the indexer:

1. **Verify Data**: Check that markets and trades are being indexed
2. **Test Queries**: Run example queries to ensure data is correct
3. **Deploy Frontend**: Configure frontend to use indexer GraphQL endpoint
4. **Set Up Monitoring**: Configure alerts for sync lag and errors
5. **Document API**: Create API documentation for frontend developers

See:
- [Frontend Deployment Guide](./jeju-market-frontend-setup.md)
- [Complete Deployment Checklist](./jeju-market-complete-deployment.md)

## Support

For issues:
- Check logs first: `tail -f processor.log api.log`
- Verify RPC is working: `cast block-number --rpc-url $RPC_ETH_HTTP`
- Check database: `psql -U squid -d indexer`
- Review Subsquid docs: https://docs.subsquid.io/
- Ask in Discord: https://discord.gg/subsquid
