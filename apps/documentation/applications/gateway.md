# Gateway

Protocol infrastructure portal.

**URL**: http://localhost:4001 | https://gateway.jeju.network

## Features

- **Token Bridge**: Bridge ERC20s from Base
- **Paymaster Deployment**: Turn any token into protocol token
- **Liquidity**: Provide ETH, earn gas payment fees
- **Node Staking**: Register and stake as RPC node operator
- **App Registry**: ERC-8004 registration
- **Moderation**: Decentralized governance

## Philosophy

Any token with paymaster + ETH liquidity = equal protocol power

## Paymaster Deployment

1. Register token (0.1 ETH fee)
2. Set fee range (0-5%)
3. Deploy via PaymasterFactory
4. Add initial ETH liquidity
5. Users can now pay gas with your token

## LP Rewards

- 70% of fees → ETH LPs
- 30% of fees → Token LPs
- Claim anytime, no lock-up

## Node Staking

Requirements:
- 8+ cores, 16GB RAM, 500GB SSD
- Stake: Any protocol token
- Public RPC endpoint

Bonuses:
- +50% for underserved regions (South America, Africa)

## Development

```bash
cd apps/gateway
bun install
bun run dev
```

## A2A Skills

```bash
curl http://localhost:4001/api/a2a \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"parts":[{"kind":"data","data":{"skillId":"list-tokens"}}]}},"id":1}'
```

Skills: `list-tokens`, `get-token-config`, `list-paymasters`, `list-nodes`, `get-network-stats`
