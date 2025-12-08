# Developer Quick Start

## 1. Get Testnet ETH

**Faucet**: https://faucet.jeju.network

Or bridge from Sepolia → Base Sepolia → Jeju Testnet.

## 2. Add Network

```
Network: Jeju Testnet
RPC: https://testnet-rpc.jeju.network
Chain ID: 420690
Explorer: https://testnet-explorer.jeju.network
```

Or: [chainlist.org/chain/420690](https://chainlist.org/chain/420690)

## 3. Deploy Contract

```bash
forge init my-project && cd my-project

cat > src/Counter.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Counter {
    uint256 public count;
    function increment() public { count++; }
}
EOF

forge create src/Counter.sol:Counter \
  --rpc-url https://testnet-rpc.jeju.network \
  --private-key $PRIVATE_KEY
```

## 4. Interact

```bash
# Read
cast call $CONTRACT "count()" --rpc-url https://testnet-rpc.jeju.network

# Write
cast send $CONTRACT "increment()" \
  --rpc-url https://testnet-rpc.jeju.network \
  --private-key $PRIVATE_KEY
```

## 5. Frontend

```typescript
import { defineChain } from 'viem';

export const jejuTestnet = defineChain({
  id: 420690,
  name: 'Jeju Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.jeju.network'] } },
  blockExplorers: { default: { name: 'Explorer', url: 'https://testnet-explorer.jeju.network' } },
  testnet: true,
});
```

## 6. Mainnet

```bash
forge create src/Counter.sol:Counter \
  --rpc-url https://rpc.jeju.network \
  --private-key $MAINNET_KEY --verify

# Chain ID: 420691
```

## Resources

- [Local Development](./local-development)
- [Deploy Contracts](./deploy-contracts)
- [DeFi Integration](./defi-protocols)
- [Run RPC Node](./run-rpc-node)
