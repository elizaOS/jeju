# IPFS

Self-hosted IPFS storage with x402 micropayments.

**URL**: http://localhost:3100

## Architecture

```
Kubo IPFS Node (4100) → Pinning API (3100) → FileStorageManager.sol
```

## Setup

```bash
# Install Kubo
curl -O https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_darwin-amd64.tar.gz
tar -xvzf kubo_*.tar.gz && cd kubo && sudo bash install.sh

# Start daemon
ipfs init && ipfs daemon

# Start pinning API
cd apps/ipfs/pinning-api
bun install && bun run dev
```

## API Endpoints

```bash
POST /pins        # Pin CID
GET  /pins        # List pins
GET  /pins/{id}   # Pin status
DELETE /pins/{id} # Unpin
POST /upload      # Upload file
GET  /ipfs/{cid}  # Retrieve
```

## x402 Pricing

- Storage: $0.10/GB/month
- Retrieval: Free (public gateway)
- Tokens: USDC, elizaOS, ETH

## A2A Skills

- `upload-file` - Upload and pin
- `pin-existing-cid` - Pin existing content
- `retrieve-file` - Fetch by CID
- `list-pins` - Query pins
- `calculate-cost` - Estimate costs

## Frontend

http://localhost:4001/storage (Gateway Portal)
