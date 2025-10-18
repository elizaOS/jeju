# JejuMarket Complete Deployment Checklist

This is the master checklist for deploying the complete JejuMarket prediction market platform. Follow this step-by-step guide to ensure a successful deployment to testnet or mainnet.

## Overview

JejuMarket consists of three main components that must be deployed in order:

1. **Smart Contracts** - Core betting and market logic
2. **Indexer** - Data indexing and GraphQL API
3. **Frontend** - User interface

## Prerequisites

### Required Tools

- [ ] Foundry installed and up to date
- [ ] Bun or Node.js v20+ installed
- [ ] Cast CLI available
- [ ] Subsquid CLI installed (`npm install -g @subsquid/cli`)
- [ ] Git configured
- [ ] Docker installed (for indexer database)

### Required Accounts and Access

- [ ] Deployer wallet with sufficient funds
  - Testnet: 5+ ETH
  - Mainnet: 10+ ETH
- [ ] Private key stored securely (use .env, never commit)
- [ ] RPC endpoint access (public or private)
- [ ] WalletConnect Project ID (create at cloud.walletconnect.com)
- [ ] Domain name configured (for production)
- [ ] Hosting account (Vercel, Netlify, or VPS)

### Required Knowledge

- [ ] Network configuration (chain ID, RPC URLs)
- [ ] Basic Solidity contract interaction
- [ ] PostgreSQL database management
- [ ] Next.js application deployment
- [ ] DNS and domain configuration

## Deployment Order

```
┌─────────────────┐
│  1. Contracts   │
│  ↓ Deploy      │
│  ↓ Verify      │
└─────────────────┘
        ↓
┌─────────────────┐
│  2. Indexer     │
│  ↓ Configure   │
│  ↓ Sync        │
└─────────────────┘
        ↓
┌─────────────────┐
│  3. Frontend    │
│  ↓ Build       │
│  ↓ Deploy      │
└─────────────────┘
        ↓
┌─────────────────┐
│  4. Testing     │
│  ↓ E2E Tests   │
│  ↓ Go Live     │
└─────────────────┘
```

---

## Phase 1: Contract Deployment

### 1.1 Pre-Deployment Preparation

- [ ] Clone repository and checkout correct branch
  ```bash
  git clone https://github.com/elizaos/jeju.git
  cd jeju
  git checkout main  # or specific release tag
  ```

- [ ] Set up environment variables
  ```bash
  cp .env.example .env
  # Edit .env with your configuration
  ```

- [ ] Configure network settings
  ```bash
  export NETWORK=testnet  # or mainnet
  export PRIVATE_KEY=0x...
  export RPC_URL=https://testnet-rpc.jeju.network
  ```

- [ ] Verify deployer balance
  ```bash
  cast balance $(cast wallet address $PRIVATE_KEY) --rpc-url $RPC_URL
  ```

- [ ] Compile contracts
  ```bash
  cd contracts
  forge build
  forge test  # Ensure all tests pass
  ```

### 1.2 Deploy Contracts

- [ ] Run deployment script
  ```bash
  cd /path/to/jeju
  DEPLOY_ENV=$NETWORK bun run scripts/deploy-jeju-market.ts
  ```

- [ ] Verify deployment output
  - [ ] ElizaOS token deployed
  - [ ] JejuMarket contract deployed
  - [ ] PredictionOracle deployed (if applicable)
  - [ ] All addresses saved to `deployments/jeju-market-$NETWORK.json`

- [ ] Save deployment addresses
  ```bash
  # Copy for reference
  cp deployments/jeju-market-$NETWORK.json deployments/jeju-market-$NETWORK-$(date +%Y%m%d).json
  ```

### 1.3 Verify Contracts

- [ ] Run verification script
  ```bash
  NETWORK=$NETWORK bun run scripts/verify-jeju-market-contracts.ts
  ```

- [ ] Review verification report
  - [ ] All contracts have code on-chain
  - [ ] Token functions work correctly
  - [ ] Permissions set properly
  - [ ] No critical failures

- [ ] Verify on block explorer (optional but recommended)
  ```bash
  # If using a compatible block explorer
  cd contracts
  forge verify-contract $CONTRACT_ADDRESS src/Contract.sol:ContractName \
    --chain-id $CHAIN_ID --etherscan-api-key $API_KEY
  ```

### 1.4 Post-Deployment Contract Setup

- [ ] Mint initial token supply (if needed)
  ```bash
  cast send $ELIZA_OS_ADDRESS "mint(address,uint256)" \
    $YOUR_ADDRESS 1000000000000000000000000 \
    --private-key $PRIVATE_KEY --rpc-url $RPC_URL
  ```

- [ ] Set up initial market (optional, for testing)
  ```bash
  # Call createMarket or equivalent function
  ```

- [ ] Configure access control
  - [ ] Verify owner addresses
  - [ ] Set admin roles if applicable
  - [ ] Transfer ownership if needed (CAREFULLY!)

### 1.5 Contract Deployment Verification Checklist

- [ ] Deployment summary generated
- [ ] All contract addresses documented
- [ ] Environment file generated for frontend
- [ ] Deployment backed up off-site
- [ ] Team notified of deployment

---

## Phase 2: Indexer Deployment

### 2.1 Database Setup

- [ ] Set up PostgreSQL database
  ```bash
  cd indexer
  # Option A: Docker (recommended for development)
  npm run db:up

  # Option B: Production database
  # Create database on managed PostgreSQL service
  ```

- [ ] Verify database connection
  ```bash
  psql -U squid -d indexer -c "SELECT version();"
  ```

### 2.2 Indexer Configuration

- [ ] Update environment variables
  ```bash
  cd indexer
  cp .env.example .env

  # Edit .env with:
  export RPC_ETH_HTTP=https://testnet-rpc.jeju.network
  export START_BLOCK=1000000  # Block where contracts were deployed
  export JEJU_MARKET_ADDRESS=0x...
  export PREDICTION_ORACLE_ADDRESS=0x...
  ```

- [ ] Verify ABI files are up to date
  ```bash
  ls -la indexer/abi/
  # Should see JejuMarket.json, PredictionOracle.json
  ```

- [ ] Update contract addresses in processor
  ```bash
  # Edit indexer/src/market-processor.ts if needed
  ```

### 2.3 Deploy Indexer

- [ ] Run database migrations
  ```bash
  cd indexer
  npm run db:create
  npm run db:migrate
  ```

- [ ] Start indexer processor
  ```bash
  # Development
  npm run dev

  # Production
  npm run build
  nohup npm run process > processor.log 2>&1 &
  ```

- [ ] Start GraphQL API server
  ```bash
  # Development (already started by 'npm run dev')

  # Production
  nohup npm run api > api.log 2>&1 &
  ```

### 2.4 Verify Indexer

- [ ] Check processor is syncing
  ```bash
  tail -f indexer/processor.log
  # Should see "Processing block X" messages
  ```

- [ ] Test GraphQL endpoint
  ```bash
  curl http://localhost:4350/graphql \
    -H "Content-Type: application/json" \
    -d '{"query": "{ __schema { queryType { name } } }"}'
  ```

- [ ] Query indexed data
  ```bash
  curl http://localhost:4350/graphql \
    -H "Content-Type: application/json" \
    -d '{"query": "{ predictionMarkets { id question } }"}'
  ```

- [ ] Verify sync status
  ```bash
  # Compare indexer height with chain height
  # Indexer should catch up within minutes
  ```

### 2.5 Indexer Deployment Checklist

- [ ] Database running and accessible
- [ ] Processor syncing blocks
- [ ] GraphQL API responding
- [ ] Test queries return data
- [ ] Logs look healthy (no errors)
- [ ] Monitoring configured (optional)

---

## Phase 3: Frontend Deployment

### 3.1 Build Configuration

- [ ] Update environment variables
  ```bash
  cd apps/jeju-market

  # Use .env file generated by deployment script
  cp .env.$NETWORK .env.local

  # Or create manually:
  cat > .env.local << EOF
  NEXT_PUBLIC_RPC_URL=https://testnet-rpc.jeju.network
  NEXT_PUBLIC_CHAIN_ID=420690
  NEXT_PUBLIC_JEJU_MARKET_ADDRESS=0x...
  NEXT_PUBLIC_ELIZA_OS_ADDRESS=0x...
  NEXT_PUBLIC_GRAPHQL_URL=https://indexer-testnet.jeju.network/graphql
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
  EOF
  ```

- [ ] Verify chain configuration in `app/providers.tsx`
  - [ ] Chain ID matches
  - [ ] RPC URL correct
  - [ ] Native currency configured

- [ ] Update contract ABIs if needed
  ```bash
  # Copy from contracts/out if contracts changed
  ```

### 3.2 Build and Test Locally

- [ ] Install dependencies
  ```bash
  cd apps/jeju-market
  bun install
  ```

- [ ] Test in development mode
  ```bash
  bun run dev
  # Open http://localhost:3003
  # Test wallet connection and basic functionality
  ```

- [ ] Build for production
  ```bash
  bun run build
  ```

- [ ] Test production build locally
  ```bash
  bun run start
  # Verify everything works in production mode
  ```

### 3.3 Deploy Frontend

Choose your deployment platform:

#### Option A: Vercel (Recommended)

- [ ] Connect repository to Vercel
- [ ] Set root directory to `apps/jeju-market`
- [ ] Add environment variables
- [ ] Deploy
  ```bash
  vercel --prod
  ```
- [ ] Verify deployment URL

#### Option B: Netlify

- [ ] Connect repository to Netlify
- [ ] Configure build settings
- [ ] Add environment variables
- [ ] Deploy
  ```bash
  netlify deploy --prod
  ```

#### Option C: Self-Hosted

- [ ] Transfer files to server
  ```bash
  rsync -avz .next package.json user@server:/var/www/jeju-market/
  ```
- [ ] Install dependencies on server
  ```bash
  ssh user@server
  cd /var/www/jeju-market
  bun install --production
  ```
- [ ] Start with PM2
  ```bash
  pm2 start npm --name jeju-market -- start
  pm2 save
  ```
- [ ] Configure Nginx reverse proxy
- [ ] Set up SSL with Let's Encrypt

### 3.4 Domain Configuration

- [ ] Add custom domain
  - Vercel/Netlify: Add in dashboard
  - Self-hosted: Configure DNS A record

- [ ] Update DNS records
  ```
  Type: A or CNAME
  Name: market
  Value: YOUR_IP or deployment-url.vercel.app
  ```

- [ ] Verify SSL certificate
  ```bash
  curl -I https://market.jeju.network
  # Should return 200 OK with SSL
  ```

- [ ] Test domain access
  ```bash
  curl https://market.jeju.network
  ```

### 3.5 Frontend Deployment Checklist

- [ ] Production build successful
- [ ] Deployed to hosting platform
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Environment variables set correctly
- [ ] Site accessible and loads properly

---

## Phase 4: End-to-End Testing

### 4.1 Smoke Tests

- [ ] Homepage loads
- [ ] Market list displays
- [ ] Individual market page loads
- [ ] Wallet connection works
- [ ] Network detection correct

### 4.2 Core Functionality Tests

Test the complete user flow:

#### Create a Test Market (if you have admin access)

- [ ] Navigate to create market page
- [ ] Fill in market details
- [ ] Submit transaction
- [ ] Verify market appears in list
- [ ] Check indexer picked up event

#### Place a Bet

- [ ] Connect wallet with test funds
- [ ] Select a market
- [ ] Choose YES or NO
- [ ] Enter bet amount
- [ ] Approve token spending (if needed)
- [ ] Submit bet transaction
- [ ] Verify transaction confirms
- [ ] Check position updates
- [ ] Verify indexer updated data

#### View Portfolio

- [ ] Navigate to portfolio page
- [ ] Verify positions display correctly
- [ ] Check profit/loss calculations
- [ ] Verify transaction history

#### Resolve Market (if applicable)

- [ ] Trigger market resolution (via oracle or admin)
- [ ] Verify market marked as resolved
- [ ] Check winning positions can claim

#### Claim Winnings

- [ ] Navigate to resolved market
- [ ] Click claim winnings
- [ ] Submit transaction
- [ ] Verify tokens received
- [ ] Check position marked as claimed

### 4.3 Cross-Browser Testing

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (mobile iOS)

### 4.4 Wallet Testing

- [ ] MetaMask
- [ ] WalletConnect
- [ ] Coinbase Wallet
- [ ] Other popular wallets

### 4.5 Performance Testing

- [ ] Run Lighthouse audit
  ```bash
  # Target scores:
  # Performance: 90+
  # Accessibility: 90+
  # Best Practices: 90+
  # SEO: 90+
  ```

- [ ] Test page load times
  - Homepage: < 2s
  - Market page: < 3s
  - Portfolio: < 3s

- [ ] Test with slow network (3G throttling)

### 4.6 Security Testing

- [ ] No private keys or secrets in code
- [ ] Environment variables not exposed
- [ ] HTTPS enforced
- [ ] CSP headers configured
- [ ] XSS protection enabled
- [ ] CORS configured correctly

---

## Phase 5: Go-Live Preparation

### 5.1 Monitoring Setup

- [ ] Set up uptime monitoring
  - UptimeRobot, Pingdom, or similar
  - Alert on downtime

- [ ] Configure error tracking
  - Sentry or similar
  - Test error reporting

- [ ] Set up analytics
  - Google Analytics
  - Custom event tracking

- [ ] Configure performance monitoring
  - Vercel Analytics or similar
  - Track Core Web Vitals

### 5.2 Documentation

- [ ] Update README with deployment info
- [ ] Document contract addresses
- [ ] Create user guide
- [ ] Write API documentation
- [ ] Prepare FAQ

### 5.3 Communication

- [ ] Notify team of deployment
- [ ] Prepare announcement (social media, blog, etc.)
- [ ] Update website/documentation links
- [ ] Inform stakeholders

### 5.4 Backup and Recovery

- [ ] Backup deployment files
  ```bash
  tar -czf jeju-market-deployment-$(date +%Y%m%d).tar.gz \
    deployments/ \
    apps/jeju-market/.env.production \
    indexer/.env
  ```

- [ ] Document rollback procedures
- [ ] Test rollback process
- [ ] Store backups securely off-site

---

## Phase 6: Post-Launch

### 6.1 Immediate Post-Launch (First 24 Hours)

- [ ] Monitor error rates
- [ ] Watch for unusual activity
- [ ] Check user feedback
- [ ] Verify indexer staying synced
- [ ] Monitor server resources

### 6.2 First Week

- [ ] Review analytics
- [ ] Address user-reported issues
- [ ] Optimize based on usage patterns
- [ ] Fine-tune monitoring alerts
- [ ] Document lessons learned

### 6.3 Ongoing Maintenance

- [ ] Regular health checks
- [ ] Database maintenance (vacuum, reindex)
- [ ] Update dependencies
- [ ] Monitor for security issues
- [ ] Plan feature updates

---

## Emergency Procedures

### Rollback Contracts

**⚠️ WARNING**: Contract rollbacks are complex and may not be possible. Plan carefully!

If critical bug found in contracts:
1. Pause contracts (if pause functionality exists)
2. Notify users immediately
3. Assess impact and plan fix
4. Deploy fixed version
5. Migrate state if necessary

### Rollback Indexer

```bash
cd indexer
# Stop processor and API
pm2 stop all

# Restore database backup
psql -U squid -d indexer < backup.sql

# Restart services
pm2 restart all
```

### Rollback Frontend

Vercel:
```bash
vercel rollback
```

Self-hosted:
```bash
pm2 stop jeju-market
cd /var/www/jeju-market.backup
pm2 start npm --name jeju-market -- start
```

---

## Success Criteria

Deployment is considered successful when:

- [ ] ✅ All contracts deployed and verified
- [ ] ✅ Indexer syncing and serving data
- [ ] ✅ Frontend accessible on custom domain
- [ ] ✅ Users can connect wallets
- [ ] ✅ Users can place bets successfully
- [ ] ✅ Markets resolve correctly
- [ ] ✅ Users can claim winnings
- [ ] ✅ No critical errors in logs
- [ ] ✅ Performance metrics meet targets
- [ ] ✅ Monitoring and alerts configured
- [ ] ✅ Team trained on operations

---

## Common Issues and Solutions

### Issue: Contract deployment fails

**Solution**:
- Check deployer balance
- Verify RPC is accessible
- Increase gas limit
- Check for compiler errors

### Issue: Indexer not syncing

**Solution**:
- Verify RPC connection
- Check START_BLOCK is correct
- Ensure database is accessible
- Review processor logs for errors

### Issue: Frontend can't connect to contracts

**Solution**:
- Verify contract addresses in .env
- Check RPC URL is correct
- Ensure chain ID matches
- Test contract calls with cast

### Issue: Wallet won't connect

**Solution**:
- Check WalletConnect Project ID
- Verify chain is configured in providers.tsx
- Test with different wallet
- Check browser console for errors

---

## Support and Resources

### Documentation
- [Indexer Setup Guide](./jeju-market-indexer-setup.md)
- [Frontend Setup Guide](./jeju-market-frontend-setup.md)
- [Monitoring Guide](./monitoring.md)
- [Runbooks](./runbooks.md)

### Tools
- Foundry: https://book.getfoundry.sh/
- Subsquid: https://docs.subsquid.io/
- Next.js: https://nextjs.org/docs
- Vercel: https://vercel.com/docs

### Community
- GitHub Issues: For bug reports
- Discord: For real-time support
- Documentation: For guides and tutorials

---

## Sign-Off

Before considering deployment complete, get sign-off from:

- [ ] Lead Developer
- [ ] DevOps Engineer
- [ ] QA Team
- [ ] Product Manager
- [ ] Security Team (for mainnet)

**Deployment Date**: _______________

**Deployed By**: _______________

**Verified By**: _______________

**Notes**: _______________________________________________

---

## Appendix: Quick Reference

### Essential Commands

```bash
# Deploy contracts
DEPLOY_ENV=testnet bun run scripts/deploy-jeju-market.ts

# Verify contracts
NETWORK=testnet bun run scripts/verify-jeju-market-contracts.ts

# Start indexer
cd indexer && npm run dev

# Build frontend
cd apps/jeju-market && bun run build

# Deploy frontend (Vercel)
vercel --prod
```

### Important Files

- `deployments/jeju-market-$NETWORK.json` - Contract addresses
- `indexer/.env` - Indexer configuration
- `apps/jeju-market/.env.production` - Frontend configuration
- `contracts/out/` - Contract ABIs

### Key URLs

- RPC: https://testnet-rpc.jeju.network
- Explorer: https://testnet-explorer.jeju.network
- Indexer: https://indexer-testnet.jeju.network/graphql
- Frontend: https://market.jeju.network

---

**Good luck with your deployment! 🚀**
