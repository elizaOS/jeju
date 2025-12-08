# Local Development

## Start

```bash
bun run dev            # Full environment (localnet + indexer + apps)
bun run dev -- --minimal  # Just localnet
```

Press `Ctrl+C` to stop.

## Test Accounts

```javascript
// Account 0 (deployer)
address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
```

All 10 Foundry accounts pre-funded with 10,000 ETH.

## Workflow

```bash
# Terminal 1: Dev environment
bun run dev

# Terminal 2: Contract development
cd contracts
forge test --watch

# Deploy
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:9545
```

## Debugging

```bash
# Trace tx
forge test --match-test testYourFunction -vvvv

# Gas report
forge test --gas-report

# Check RPC
curl -X POST http://localhost:9545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# View logs
kurtosis service logs jeju-localnet op-geth
```

## GraphQL

Indexer runs at http://localhost:4350/graphql

```bash
curl http://localhost:4350/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ blocks(limit: 1) { number } }"}'
```

## Reset

```bash
bun run scripts/localnet/reset.ts
# Or: kurtosis enclave rm -f jeju-localnet
```
