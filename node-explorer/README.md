# Jeju Node Explorer

Real-time dashboard for monitoring Jeju node operators and network health.

## Overview

The Node Explorer is a Next.js application that provides:

- **Node Operator Dashboard**: Track all registered RPC nodes
- **Performance Metrics**: Uptime, response time, request volume
- **Geographic Distribution**: World map showing node locations
- **Reward Tracking**: View pending and claimed rewards
- **Network Statistics**: Global network health metrics
- **Node Registration**: Web interface for registering new nodes

## Architecture

```
┌──────────────────────────────────────────────┐
│ Frontend (Next.js + React)                    │
│ - Interactive dashboard                       │
│ - Real-time charts (Recharts)                │
│ - World map (Leaflet)                         │
└────────────────┬─────────────────────────────┘
                 │
                 │ REST API
                 ↓
┌──────────────────────────────────────────────┐
│ API Server (Express)                          │
│ - /api/nodes - List all nodes                │
│ - /api/nodes/:id - Get node details          │
│ - /api/heartbeat - Submit heartbeat          │
│ - /api/stats - Network statistics            │
└────────────────┬─────────────────────────────┘
                 │
                 │ PostgreSQL
                 ↓
┌──────────────────────────────────────────────┐
│ Database                                      │
│ - nodes table                                 │
│ - heartbeats table                            │
│ - network_stats table (aggregated)           │
└──────────────────────────────────────────────┘
                 │
                 │ RPC Calls
                 ↓
┌──────────────────────────────────────────────┐
│ Jeju L2                                       │
│ - NodeOperatorRewards contract               │
│ - Node registration verification             │
└──────────────────────────────────────────────┘
```

## Quick Start

### Development

```bash
cd node-explorer

# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
bun run dev

# Open browser
open http://localhost:3000
```

### Production

```bash
# Build
bun run build

# Start production server
bun run start

# Or with Docker
docker build -t jeju-node-explorer .
docker run -p 3000:3000 jeju-node-explorer
```

## Environment Variables

```bash
# .env

# Database (required)
DATABASE_URL=postgresql://user:pass@localhost:5432/node_explorer

# Jeju RPC (required)
JEJU_RPC_URL=https://rpc.jeju.network
JEJU_REWARDS_CONTRACT=0x...  # NodeOperatorRewards contract address

# API Configuration
API_PORT=3001
API_BASE_URL=http://localhost:3001

# Optional: External services
MAPBOX_TOKEN=pk_...  # For map tiles
ANALYTICS_ID=G-...   # Google Analytics
```

## API Endpoints

### GET /api/nodes

List all registered nodes.

**Response:**
```json
{
  "nodes": [
    {
      "id": "node_abc123",
      "operator_address": "0x123...",
      "rpc_url": "https://rpc.example.com",
      "location": "North America",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "uptime_score": 9954,
      "status": "online",
      "last_heartbeat": 1705329600
    }
  ],
  "total": 42
}
```

### GET /api/nodes/:id

Get detailed information about a specific node.

**Response:**
```json
{
  "node": {
    "id": "node_abc123",
    "operator_address": "0x123...",
    "rpc_url": "https://rpc.example.com",
    "version": "v1.0.3",
    "uptime_score": 9954,
    "total_requests": 1534892,
    "avg_response_time": 45,
    "pending_rewards": "240000000000000000000",
    "total_claimed": "1200000000000000000000"
  }
}
```

### POST /api/heartbeat

Submit node heartbeat (called by node's heartbeat service).

**Request:**
```json
{
  "node_id": "node_abc123",
  "signature": "0x...",
  "data": {
    "block_number": 12345,
    "peer_count": 50,
    "is_syncing": false,
    "response_time": 42
  }
}
```

### GET /api/stats

Get aggregated network statistics.

**Response:**
```json
{
  "totalNodes": 42,
  "activeNodes": 38,
  "totalRequests": 15348920,
  "avgUptime": 0.9954,
  "avgResponseTime": 52,
  "geographicDistribution": {
    "North America": 15,
    "Europe": 12,
    "Asia": 10,
    "Other": 5
  }
}
```

### POST /api/register

Register a new node (web form submission).

**Request:**
```json
{
  "operator_address": "0x123...",
  "rpc_url": "https://rpc.example.com",
  "location": "Europe",
  "signature": "0x..."
}
```

## Database Schema

### nodes Table

```sql
CREATE TABLE nodes (
  id VARCHAR PRIMARY KEY,
  operator_address VARCHAR NOT NULL,
  rpc_url VARCHAR NOT NULL,
  ws_url VARCHAR,
  location VARCHAR,
  latitude DECIMAL,
  longitude DECIMAL,
  version VARCHAR,
  first_seen BIGINT NOT NULL,
  last_heartbeat BIGINT NOT NULL,
  uptime_score INTEGER NOT NULL,
  total_requests BIGINT DEFAULT 0,
  status VARCHAR NOT NULL,  -- 'online', 'offline', 'syncing'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_operator ON nodes(operator_address);
CREATE INDEX idx_status ON nodes(status);
CREATE INDEX idx_last_heartbeat ON nodes(last_heartbeat);
```

### heartbeats Table

```sql
CREATE TABLE heartbeats (
  id SERIAL PRIMARY KEY,
  node_id VARCHAR NOT NULL REFERENCES nodes(id),
  timestamp BIGINT NOT NULL,
  block_number BIGINT,
  peer_count INTEGER,
  is_syncing BOOLEAN,
  response_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_node_id ON heartbeats(node_id);
CREATE INDEX idx_timestamp ON heartbeats(timestamp);
```

## Components

### Dashboard (`src/app/page.tsx`)

Main dashboard showing:
- Network statistics cards
- Active nodes list
- Geographic distribution map
- Performance charts

**Features:**
- Real-time updates every 30 seconds
- Responsive design (mobile-friendly)
- Interactive charts and graphs
- Filterable node list

### Registration Form (`src/app/register/page.tsx`)

Node registration interface:
- Connect wallet (MetaMask)
- Submit node details
- Sign registration message
- Verify on-chain stake

### API Server (`src/api/server.ts`)

Express.js API server:
- RESTful endpoints
- PostgreSQL integration
- Blockchain integration
- Heartbeat processing

### Collector (`src/collector/node-collector.ts`)

Background service that:
- Scans network for new nodes
- Verifies node health
- Updates node status
- Aggregates statistics

## Development

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL 15+
- Jeju RPC access

### Setup Database

```bash
# Create database
createdb node_explorer

# Run migrations
psql node_explorer < db/schema.sql
```

### Run Development Server

```bash
# Frontend
bun run dev

# API server (separate terminal)
bun run src/api/server.ts

# Collector (separate terminal)
bun run src/collector/node-collector.ts
```

### Run Tests

```bash
# Unit tests
bun test

# Integration tests
bun test --integration

# E2E tests (requires running server)
bun test:e2e
```

## Deployment

### Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Kubernetes

```bash
# Deploy with Helm (see k8s/helm/node-explorer/)
helm install node-explorer ./k8s/helm/node-explorer \
  -n monitoring \
  --create-namespace
```

### Vercel/Netlify

The frontend can be deployed to Vercel/Netlify:

```bash
# Build static export
bun run build
bun run export

# Deploy to Vercel
vercel deploy
```

API server must be deployed separately (e.g., on AWS/GCP).

## Configuration

### Tailwind CSS

Styling configuration in `tailwind.config.js`:
- Custom colors for Jeju branding
- Responsive breakpoints
- Dark mode support

### Next.js

Configuration in `next.config.js`:
- API routes
- Image optimization
- Static export settings

## Monitoring

### Health Checks

```bash
# Check frontend
curl http://localhost:3000

# Check API
curl http://localhost:3001/api/health

# Check database
psql node_explorer -c "SELECT COUNT(*) FROM nodes;"
```

### Logs

```bash
# Frontend logs (Next.js)
tail -f .next/trace

# API logs
tail -f logs/api.log

# Collector logs
tail -f logs/collector.log
```

## Analytics

Track node operator engagement:

- Total registered nodes
- Active vs inactive nodes
- Geographic distribution
- Average uptime trends
- Reward distribution stats

## Security

### API Rate Limiting

```typescript
// In src/api/server.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
});

app.use('/api/', limiter);
```

### Input Validation

All user inputs are validated:
- Address format validation
- URL format validation
- Signature verification
- SQL injection prevention

### CORS Configuration

Configured for production domains:

```typescript
app.use(cors({
  origin: [
    'https://nodes.jeju.network',
    'https://testnet-nodes.jeju.network',
  ],
  credentials: true,
}));
```

## Troubleshooting

### "Database connection failed"

```bash
# Check PostgreSQL is running
psql -l

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

### "RPC connection failed"

```bash
# Check RPC is accessible
curl -X POST http://localhost:9545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### "Map not loading"

- Check MAPBOX_TOKEN is set
- Verify API token is valid
- Check browser console for errors

## Future Enhancements

- [ ] Real-time WebSocket updates
- [ ] Advanced filtering and sorting
- [ ] Historical performance trends
- [ ] Alerting for node downtime
- [ ] Operator leaderboard
- [ ] Reward calculator
- [ ] Multi-chain support

## Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Recharts**: https://recharts.org/
- **Leaflet**: https://leafletjs.com/
- **Express**: https://expressjs.com/

## Support

- Discord: [#node-operators](https://discord.gg/jeju)
- Email: operators@jeju.network
- GitHub: [Report issues](https://github.com/jeju-l3/jeju/issues)
