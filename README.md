# Jeju Network

A comprehensive blockchain platform featuring an L2 network, DeFi applications, AI agents, and 3D virtual worlds.

## 🎮 Hyperscape - Hybrid On-Chain 3D RPG

**Hyperscape is implementing hybrid blockchain integration** - critical game state on-chain, performance state off-chain.

📖 **Quick Start**: `apps/hyperscape/START_HERE.md`  
🏗️ **Architecture**: `apps/hyperscape/HYBRID_ARCHITECTURE.md`  
✅ **Status**: 95% complete (core wiring done, polish pending)

**What's On-Chain**: Player registration, inventory, equipment, combat outcomes, skills/XP  
**What's Off-Chain**: Movement (60fps), combat ticks, chat, rendering

### Smart Network Detection

Hyperscape **automatically detects** which blockchain to use:
- **In Jeju monorepo**: Uses Jeju L2/L3 (chain ID 420691 for localnet, 901 for testnet, 902 for mainnet)
- **Standalone mode**: Uses Anvil (chain ID 31337)
- **No manual RPC configuration needed!**

```bash
# Start Hyperscape with blockchain
cd apps/hyperscape
bun scripts/start-localnet.ts  # Deploy contracts (sets WORLD_ADDRESS)
npm run dev                     # Auto-detects network and starts game
bun scripts/verify-blockchain-integration.ts  # Check status
```

**Network Priority**: Jeju (preferred) → Anvil (fallback) → PostgreSQL-only mode

See `apps/hyperscape/` for complete documentation.

---

## Environment Variables Manifest

This section documents all environment variables required across the Jeju repository, organized by application/package.

### 🔐 Core Infrastructure

#### General Configuration
```bash
# Node Environment
NODE_ENV=development|production|test

# Network Selection
JEJU_NETWORK=localnet|testnet|mainnet
NETWORK=localnet|testnet|mainnet

# RPC URLs
JEJU_RPC_URL=http://localhost:9545
JEJU_RPC_URLS=http://localhost:9545,http://backup:9545  # Comma-separated fallbacks
JEJU_TESTNET_RPC_URL=https://testnet-rpc.jeju.network
JEJU_MAINNET_RPC_URL=https://rpc.jeju.network
JEJU_WS_URL=ws://localhost:9546
JEJU_L1_RPC_URL=http://localhost:8545

# Explorer
JEJU_EXPLORER_URL=http://localhost:4000
NEXT_PUBLIC_JEJU_EXPLORER=https://explorer.jeju.network

# Blockchain Configuration
CHAIN_ID=42069
START_BLOCK=0
```

#### Private Keys & Secrets
```bash
# Deployment Keys
PRIVATE_KEY=0x...                              # Main deployer private key
DEPLOYER_PRIVATE_KEY=0x...                     # Contract deployment key
TEST_PRIVATE_KEY=0x...                         # Test account private key
COLLECTOR_PRIVATE_KEY=0x...                    # Node collector key

# Service Keys
APPROVER_PRIVATE_KEY=0x...                     # OTC approver key
MIGRATION_ADMIN_PRIVATE_KEY=0x...              # Migration admin key
PRICE_UPDATER_PRIVATE_KEY=0x...                # Oracle price updater key
AGENT_PRIVATE_KEY=0x...                        # Agent private key
BETTING_AGENT_PRIVATE_KEY=0x...                # Betting agent key

# JWT & Authentication
JWT_SECRET=your-jwt-secret-here
CRON_SECRET=random_secret_minimum_32_characters  # REQUIRED in production

# Admin Access
ADMIN_CODE=your-admin-code                     # Hyperscape admin code
```

---

### 🤖 AI Services

#### OpenAI
```bash
OPENAI_API_KEY=sk-...                          # GPT-4, GPT-4o, DALL-E
SMALL_MODEL=gpt-4o-mini                        # Small model override
LARGE_MODEL=gpt-4o                             # Large model override
```

#### Anthropic
```bash
ANTHROPIC_API_KEY=sk-ant-...                   # Claude Opus/Sonnet
```

#### AI Gateway (Vercel)
```bash
AI_GATEWAY_API_KEY=...
AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1
AI_GATEWAY_SMALL_MODEL=gpt-4o-mini
AI_GATEWAY_LARGE_MODEL=gpt-4o
AI_GATEWAY_IMAGE_DESCRIPTION_MODEL=gpt-4o-mini
AI_GATEWAY_EXPERIMENTAL_TELEMETRY=false
VERCEL_AI_GATEWAY_API_KEY=...
VERCEL_OIDC_TOKEN=...
```

#### Other AI Services
```bash
GROQ_API_KEY=...
SMALL_GROQ_MODEL=llama-3.1-8b-instant
MEDIUM_GROQ_MODEL=llama-3.2-11b-vision-preview
LARGE_GROQ_MODEL=llama-3.3-70b-versatile

MESHY_API_KEY=...                              # 3D generation
FAL_KEY=...                                    # FAL AI
FAL_API_KEY=...

COINGECKO_API_KEY=...                          # Market data
BIRDEYE_API_KEY=...                            # Solana market data
```

---

### ☁️ Apps: Cloud (ElizaOS Platform)

#### Blockchain Integration
```bash
ELIZAOS_TOKEN_ADDRESS=0x...
CREDIT_PURCHASE_CONTRACT=0x...
CLOUD_PAYMASTER_ADDRESS=0x...
CLOUD_SERVICE_REGISTRY_ADDRESS=0x...
FEE_DISTRIBUTOR_ADDRESS=0x...
APP_REVENUE_WALLET=0x...
NEXT_PUBLIC_APP_REVENUE_WALLET=0x...
ENTRYPOINT_ADDRESS=0x...
PRICE_ORACLE_ADDRESS=0x...
CROSS_CHAIN_ORACLE_ADDRESS=0x...
```

#### Application URLs
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
CORS_DOMAINS=http://localhost:3000,https://app.example.com
```

---

### 💱 Apps: OTC Agent

#### Network Configuration
```bash
NEXT_PUBLIC_JEJU_NETWORK=localnet|testnet|mainnet
NEXT_PUBLIC_JEJU_RPC_URL=http://127.0.0.1:9545

# Multi-chain RPCs
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545      # Hardhat/local
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BSC_RPC_URL=https://bsc-dataseed1.binance.org
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
```

#### Contract Addresses
```bash
# Jeju Contracts
NEXT_PUBLIC_JEJU_OTC_ADDRESS=0x...
NEXT_PUBLIC_JEJU_USDC_ADDRESS=0x...
NEXT_PUBLIC_OTC_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...

# Multi-chain Contracts
NEXT_PUBLIC_BASE_OTC_ADDRESS=0x...
NEXT_PUBLIC_BSC_OTC_ADDRESS=0x...
NEXT_PUBLIC_SOLANA_DESK=...
NEXT_PUBLIC_SOLANA_TOKEN_MINT=...
NEXT_PUBLIC_SOLANA_USDC_MINT=...
```

#### Agent & Worker
```bash
POSTGRES_URL=postgresql://...                   # Agent database
WORKER_AUTH_TOKEN=...                          # Worker authentication
```

#### WalletConnect
```bash
NEXT_PUBLIC_PROJECT_ID=...                     # WalletConnect project ID
```

#### API URLs
```bash
NEXT_PUBLIC_URL=http://localhost:2222
NEXT_PUBLIC_API_URL=...
```

---

### 🚀 Apps: Launchpad

#### Network & RPC
```bash
NEXT_PUBLIC_JEJU_NETWORK=localnet|testnet|mainnet
NEXT_PUBLIC_JEJU_RPC_URL=http://127.0.0.1:9545
JEJU_RPC_URL=http://127.0.0.1:9545

# External Chain APIs
ALCHEMY_API_KEY=...
NEXT_PUBLIC_ALCHEMY_API_KEY=...
HELIUS_API_KEY=...
NEXT_PUBLIC_HELIUS_API_KEY=...
NEXT_PUBLIC_BSC_RPC_URL=...
```

#### Token Configuration
```bash
NEXT_PUBLIC_NETWORK=devnet|mainnet
NEXT_PUBLIC_TOKEN_SUPPLY=1000000000
NEXT_PUBLIC_DECIMALS=9
```

#### Backend Configuration
```bash
JWT_SECRET=...
API_URL=...
```

#### Server URLs
```bash
LAUNCHPAD_BACKEND_URL=http://localhost:3331
LAUNCHPAD_FRONTEND_URL=http://localhost:3330
```

---

### 🎮 Apps: Caliguland

#### Game Configuration
```bash
PORT=8000
SERVER_URL=http://localhost:8000
GAME_URL=http://localhost:8000
GAME_SERVER_URL=http://localhost:8000

# Game Settings
GAME_DURATION_MS=3600000                       # 60 minutes
MAX_PLAYERS=20
MIN_PLAYERS=5
```

#### Blockchain Integration
```bash
RPC_URL=http://localhost:8545
REGISTRY_ADDRESS=0x...
JEJU_MARKET_ADDRESS=0x...
ELIZA_OS_ADDRESS=0x...
```

#### Authentication
```bash
VIBEVM_USERNAME=admin
VIBEVM_PASSWORD=...
JWT_SECRET=...
JWT_EXPIRY_HOURS=24
JWT_PURPOSE=caliguland-session
JWT_KEY_PATH=caliguland/auth/signing
```

#### Agent Configuration
```bash
AGENT_ID=agent-...
AGENT_AUTOPLAY=1
AUTO_SHUTDOWN_MS=300000                        # 5 minutes
BETTING_SERVER_URL=http://localhost:9000
```

#### DStack Socket
```bash
DSTACK_SOCKET_PATH=/var/run/dstack.sock
```

---

### 🏪 Apps: Jeju Market

#### Network Configuration
```bash
NEXT_PUBLIC_RPC_URL=http://localhost:8545
RPC_URL=http://localhost:8545
NEXT_PUBLIC_CHAIN_ID=42069
CHAIN_ID=42069
```

#### Contract Addresses
```bash
NEXT_PUBLIC_JEJU_MARKET_ADDRESS=0x...
ELIZA_OS_ADDRESS=0x...
```

#### GraphQL & Indexer
```bash
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4350/graphql
GRAPHQL_URL=http://localhost:4350/graphql
```

#### WalletConnect
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

---

### 🌐 Apps: Hyperscape

#### Asset Forge Server
```bash
API_PORT=3004
MESHY_API_KEY=...                              # 3D generation
OPENAI_API_KEY=...                             # Image generation
FRONTEND_URL=...                               # CORS origin
IMAGE_SERVER_URL=http://localhost:8080
ASSET_OUTPUT_DIR=./gdd-assets
IMGUR_CLIENT_ID=...                            # Optional image hosting
```

#### Hyperscape Server
```bash
# System Configuration
SYSTEMS_PATH=...                               # Custom systems path
PLUGIN_PATH=...                                # Plugin path

# Authentication
PRIVY_APP_ID=...
PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

# Public CDN
PUBLIC_CDN_URL=https://cdn.hyperscape.io
PUBLIC_API_URL=...
PUBLIC_MAX_UPLOAD_SIZE=...
PUBLIC_STARTER_ITEMS=1                         # Enable starter items

# Debug & Features
DEBUG_RPG=1                                    # Enable RPG debugging
DISABLE_RPG=0                                  # Disable RPG systems

# Network & Saving
SAVE_INTERVAL=60                               # Seconds between saves
WS_PING_INTERVAL_SEC=5
WS_PING_MISS_TOLERANCE=3
WS_PING_GRACE_MS=5000
```

#### Plugin Hyperscape
```bash
HYPERSCAPE_TEST_WORLD=...                      # Test world ID
HYPERSCAPE_ASSETS_URL=https://assets.hyperscape.io
HYPERSCAPE_AUTH_TOKEN=...                      # Auth token
DATABASE_ADAPTER=pglite|postgres
SQLITE_FILE=...                                # SQLite path (if used)
```

#### Test Configuration
```bash
L2_RPC_URL=http://localhost:8545
```

---

### 📊 Indexer (Squid)

```bash
# RPC Configuration
RPC_ETH_HTTP=https://rpc.jeju.network
START_BLOCK=0

# Database will be configured by Squid
```

---

### 🔍 Node Explorer

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3002
API_URL=http://localhost:3002
PORT=3002
API_BASE_URL=http://localhost:3001

# Collector
SCAN_INTERVAL=300000                           # 5 minutes
```

---

### 🔮 Oracle Service

#### Oracle Configuration
```bash
# Oracle Contract
ORACLE_ADDRESS=0x...

# Token Configuration
ELIZAOS_TOKEN_BASE=0x...                       # ElizaOS on Base

# Price Update Configuration
UPDATE_INTERVAL_MS=300000                      # 5 minutes
MAX_PRICE_DEVIATION_PCT=10
MIN_UPDATE_INTERVAL_S=60

# Leader Election (Multi-instance)
BOT_ID=bot-...                                 # Unique bot identifier
LEADER_ELECTION_ENABLED=true

# Health Check
HEALTH_CHECK_PORT=3000
ENABLE_HEALTH_CHECK=true

# Gas Configuration
GAS_PRICE_MULTIPLIER=1.2
MAX_GAS_PRICE_GWEI=100
MAX_RETRIES=3
RETRY_DELAY_MS=5000
```

#### RPC URLs
```bash
BASE_RPC_URL=https://mainnet.base.org
BASE_RPC_URLS=https://mainnet.base.org,https://backup.base.org
```

#### Notifications
```bash
# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Discord
DISCORD_WEBHOOK_URL=...
```

---

### 📜 Contract Deployment & Verification

```bash
# Block Explorers
BASESCAN_API_KEY=...                           # Base network verification
ETHERSCAN_API_KEY=...                          # Ethereum verification

# Deployment Configuration
DEPLOY_ENV=local|testnet|mainnet
MIN_DEPLOYER_BALANCE=0.1                       # Minimum ETH for deployer
```

---

### 🧪 Testing & CI

```bash
# CI Configuration
CI=true

# Test URLs
BASE_URL=http://localhost:3000

# Test Account Keys (DO NOT use in production)
TEST_PRIVATE_KEY=0x...
```

---

### 📦 Snapshots & Data Management

```bash
NODE_TYPE=full|archive
DATA_DIR=/data
OUTPUT_DIR=/tmp/snapshots
```

---

## Environment Variable Priority

Environment variables are loaded in the following order (later sources override earlier ones):

1. Default values in codty](documentation/deployment/oracle-security-checklist.md) - Security best practices
- [Oracle Failover](documentation/deployment/oracle-failover-procedures.md) - Disaster recovery

**Project Status**:
- [HANDOFF.md](HANDOFF.md) - Complete development summary
- [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) - Deployment readiness report
- [TEST_REPORT.md](TEST_REPORT.md) - Test results and coverage

### OTC Agent
```bash
cd apps/otc-agent
# Create .env with NEXT_PUBLIC_* variables
bun install
bun run dev
```

### Launchpad
```bash
cd apps/launchpad
# Create .env with required variables
bun install
# Start backend
cd apps/backend && bun run dev
# Start frontend (in another terminal)
cd apps/frontend && bun run dev
```

### Hyperscape
```bash
cd apps/hyperscape
# Create .env with OPENAI_API_KEY and MESHY_API_KEY
bun install
# Start asset forge
cd packages/asset-forge && bun run server
# Start hyperscape server (in another terminal)
cd packages/server && bun run dev
```