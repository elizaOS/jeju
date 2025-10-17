# Developer Quick Start

Start building on Jeju L3 in minutes. This guide assumes you have basic Ethereum development experience.

## Prerequisites

- Node.js or Bun installed
- Foundry or Hardhat
- MetaMask or another web3 wallet
- Basic Solidity knowledge

## 1. Get Testnet ETH

### Option A: Faucet (Recommended)

Visit https://faucet.jeju.network and request testnet ETH.

### Option B: Bridge from Sepolia

1. Get Sepolia ETH: https://www.alchemy.com/faucets/ethereum-sepolia
2. Bridge to Base Sepolia: https://superbridge.app
3. Bridge to Jeju Testnet: https://testnet-bridge.jeju.network

### Option C: Request in Discord

For larger amounts, ask in [#testnet-faucet](https://discord.gg/jeju).

## 2. Configure Network

### Add Jeju Testnet to MetaMask

```
Network Name: Jeju Testnet
RPC URL: https://testnet-rpc.jeju.network
Chain ID: 420690
Currency Symbol: ETH
Block Explorer: https://testnet-explorer.jeju.network
```

Or use [chainlist.org/chain/420690](https://chainlist.org/chain/420690) for one-click setup.

## 3. Deploy Your First Contract

### Using Foundry (Recommended)

```bash
# Create new project
forge init my-jeju-project
cd my-jeju-project

# Write a simple contract
cat > src/Counter.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Counter {
    uint256 public count;
    
    function increment() public {
        count++;
    }
    
    function getCount() public view returns (uint256) {
        return count;
    }
}
EOF

# Deploy to Jeju Testnet
forge create src/Counter.sol:Counter \
  --rpc-url https://testnet-rpc.jeju.network \
  --private-key $PRIVATE_KEY

# Deployed to: 0x... (save this address)
```

### Using Hardhat

```bash
# Create new project
mkdir my-jeju-project && cd my-jeju-project
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Initialize Hardhat
npx hardhat init
# Choose "Create a TypeScript project"

# Configure hardhat.config.ts
cat > hardhat.config.ts << 'EOF'
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    jejuTestnet: {
      url: "https://testnet-rpc.jeju.network",
      chainId: 420690,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
  etherscan: {
    apiKey: {
      jejuTestnet: "YOUR_EXPLORER_API_KEY",
    },
    customChains: [
      {
        network: "jejuTestnet",
        chainId: 420690,
        urls: {
          apiURL: "https://testnet-explorer.jeju.network/api",
          browserURL: "https://testnet-explorer.jeju.network",
        },
      },
    ],
  },
};

export default config;
EOF

# Deploy
npx hardhat run scripts/deploy.ts --network jejuTestnet
```

## 4. Interact with Contract

### Using Cast (Foundry)

```bash
# Read count
cast call $CONTRACT_ADDRESS "getCount()" \
  --rpc-url https://testnet-rpc.jeju.network

# Increment
cast send $CONTRACT_ADDRESS "increment()" \
  --rpc-url https://testnet-rpc.jeju.network \
  --private-key $PRIVATE_KEY

# View on explorer
open https://testnet-explorer.jeju.network/address/$CONTRACT_ADDRESS
```

### Using Ethers.js

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(
  'https://testnet-rpc.jeju.network'
);

const signer = new ethers.Wallet(privateKey, provider);

const counter = new ethers.Contract(
  contractAddress,
  ['function increment()', 'function getCount() view returns (uint256)'],
  signer
);

// Read
const count = await counter.getCount();
console.log('Count:', count);

// Write
const tx = await counter.increment();
await tx.wait();
console.log('Incremented!');
```

### Using Viem

```typescript
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { jejuTestnet } from './chains';

const account = privateKeyToAccount(`0x${privateKey}`);

const publicClient = createPublicClient({
  chain: jejuTestnet,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: jejuTestnet,
  transport: http(),
});

// Read
const count = await publicClient.readContract({
  address: contractAddress,
  abi: counterABI,
  functionName: 'getCount',
});

// Write
const hash = await walletClient.writeContract({
  address: contractAddress,
  abi: counterABI,
  functionName: 'increment',
});

await publicClient.waitForTransactionReceipt({ hash });
```

## 5. Build a dApp Frontend

### Next.js + Wagmi

```bash
# Create Next.js app
npx create-next-app@latest my-jeju-dapp --typescript --tailwind --app
cd my-jeju-dapp

# Install dependencies
npm install wagmi viem @tanstack/react-query

# Configure chains
cat > src/chains.ts << 'EOF'
import { defineChain } from 'viem';

export const jejuTestnet = defineChain({
  id: 420690,
  name: 'Jeju Testnet',
  network: 'jeju-testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.jeju.network'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://testnet-explorer.jeju.network' },
  },
  testnet: true,
});
EOF

# Configure Wagmi
cat > src/wagmi.ts << 'EOF'
import { configureChains, createConfig } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { jejuTestnet } from './chains';

const { chains, publicClient } = configureChains(
  [jejuTestnet],
  [publicProvider()]
);

export const config = createConfig({
  autoConnect: true,
  connectors: [new MetaMaskConnector({ chains })],
  publicClient,
});

export { chains };
EOF

# Create a component
mkdir -p src/components
cat > src/components/Counter.tsx << 'EOF'
'use client';

import { useContractRead, useContractWrite } from 'wagmi';

const contractAddress = 'YOUR_CONTRACT_ADDRESS';
const abi = [
  'function getCount() view returns (uint256)',
  'function increment()',
];

export function Counter() {
  const { data: count } = useContractRead({
    address: contractAddress,
    abi,
    functionName: 'getCount',
  });

  const { write: increment } = useContractWrite({
    address: contractAddress,
    abi,
    functionName: 'increment',
  });

  return (
    <div>
      <p>Count: {count?.toString()}</p>
      <button onClick={() => increment()}>Increment</button>
    </div>
  );
}
EOF

# Run dev server
npm run dev
```

## 6. Test Your dApp

### Local Testing

```bash
# Start local Jeju network
bun run localnet:start

# Update RPC URL to localhost
# http://127.0.0.1:9545

# Deploy and test locally
forge create ... --rpc-url http://127.0.0.1:9545
```

### Testnet Testing

1. Deploy to Jeju Testnet
2. Test all functionality
3. Get feedback from community
4. Fix bugs
5. Prepare for mainnet

## 7. Deploy to Mainnet

Once thoroughly tested:

```bash
# Deploy to Jeju Mainnet
forge create src/Counter.sol:Counter \
  --rpc-url https://rpc.jeju.network \
  --private-key $MAINNET_PRIVATE_KEY \
  --verify

# Update frontend to use mainnet
# RPC: https://rpc.jeju.network
# Chain ID: 8888
```

## Example Projects

### Starter Templates

- **Foundry Template**: [github.com/your-org/jeju-foundry-template](https://github.com/your-org/jeju-foundry-template)
- **Hardhat Template**: [github.com/your-org/jeju-hardhat-template](https://github.com/your-org/jeju-hardhat-template)
- **Next.js + Wagmi**: [github.com/your-org/jeju-nextjs-template](https://github.com/your-org/jeju-nextjs-template)

### Example dApps

- **Token Swap**: [github.com/your-org/jeju-swap-example](https://github.com/your-org/jeju-swap-example)
- **NFT Minting**: [github.com/your-org/jeju-nft-example](https://github.com/your-org/jeju-nft-example)
- **DAO**: [github.com/your-org/jeju-dao-example](https://github.com/your-org/jeju-dao-example)

## Resources

### Tools

- **Block Explorer**: https://testnet-explorer.jeju.network
- **Faucet**: https://faucet.jeju.network
- **Bridge**: https://testnet-bridge.jeju.network
- **RPC**: https://testnet-rpc.jeju.network

### Documentation

- [Network Information](/network/testnet)
- [Contract Addresses](/contracts)
- [DeFi Protocols](/developers/defi-protocols)
- [API Reference](/developers/rpc-methods)

### Community

- **Discord**: [discord.gg/jeju](https://discord.gg/jeju)
- **GitHub**: [github.com/your-org/jeju](https://github.com/your-org/jeju)
- **Twitter**: [@jejul3](https://twitter.com/jejul3)

## Next Steps

- [**Local Development**](./local-development) - Deep dive into development
- [**Deploy Contracts**](./deploy-contracts) - Advanced deployment
- [**DeFi Integration**](./defi-protocols) - Use DeFi protocols
- [**Run an RPC Node**](/developers/run-rpc-node) - Operate your own infrastructure

## Need Help?

- Ask in [Discord #dev-support](https://discord.gg/jeju)
- Check [FAQs](/support)
- Read [full documentation](/)

