# Indexer

Subsquid-powered blockchain indexing with GraphQL API.

**URL**: http://localhost:4350/graphql

## What's Indexed

- Blocks, transactions, logs
- ERC20/721/1155 tokens and transfers
- Contracts with type detection
- Prediction markets (schema ready)
- Node staking (schema ready)
- ERC-8004 registry (schema ready)

## Queries

```graphql
# Recent blocks
{
  blocks(limit: 10, orderBy: number_DESC) {
    number timestamp transactionCount
  }
}

# Token transfers
{
  tokenTransfers(limit: 20, where: { tokenStandard_eq: "ERC20" }) {
    from { address } to { address } value
    token { address }
  }
}

# Contracts
{
  contracts(where: { isERC20_eq: true }) {
    address contractType creator { address }
  }
}
```

## Development

```bash
cd apps/indexer
npm install
npm run db:up
npm run dev
```

## Configuration

```bash
# .env
DB_NAME=indexer
DB_PORT=23798
GQL_PORT=4350
RPC_ETH_HTTP=http://localhost:9545
```

## Troubleshooting

```bash
# Check database
docker ps | grep squid-db

# Reset
npm run db:reset && npm run dev

# RPC check
curl -X POST http://localhost:9545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```
