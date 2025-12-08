# Indexer

Blockchain data indexer powered by Subsquid. Provides GraphQL API for blocks, transactions, events, and tokens.

## Setup

```bash
cd apps/indexer
npm install
```

## Run

```bash
# Start PostgreSQL
npm run db:up

# Start indexer
npm run dev
```

GraphQL API on http://localhost:4350/graphql

## Test

```bash
# All tests
npm run test

# GraphQL queries
./test/verify-all-queries.sh

# Integration tests
./test/integration-bazaar.sh
```
