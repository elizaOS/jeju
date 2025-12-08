# @jeju/contracts

Smart contracts, ABIs, types, and deployment addresses for Jeju Network.

## Installation

```bash
# In your app package.json:
{
  "dependencies": {
    "@jeju/contracts": "workspace:*"
  }
}

# Then run
bun install
```

## Usage

### Import Contract Addresses

```typescript
import { 
  getContractAddresses,
  getContractAddressesByNetwork,
  getIdentityRegistry,
  getBazaarMarketplace,
  getERC20Factory,
} from '@jeju/contracts';

// Get all addresses for a specific chain
const addresses = getContractAddresses(1337);
console.log(addresses.identityRegistry);
console.log(addresses.marketplace);
console.log(addresses.poolManager);

// Or by network name
const testnetAddresses = getContractAddressesByNetwork('testnet');
```

### Import ABIs

```typescript
import {
  ERC20Abi,
  ERC20FactoryAbi,
  BazaarAbi,
  IdentityRegistryAbi,
} from '@jeju/contracts';

// Use with viem
import { createPublicClient, http } from 'viem';

const client = createPublicClient({ transport: http() });
const balance = await client.readContract({
  address: tokenAddress,
  abi: ERC20Abi,
  functionName: 'balanceOf',
  args: [userAddress],
});
```

### Import Types

```typescript
import type {
  ChainId,
  NetworkName,
  ContractAddresses,
  UniswapV4Deployment,
  BazaarMarketplaceDeployment,
} from '@jeju/contracts';

// Helper functions
import { isValidAddress, ZERO_ADDRESS, CHAIN_IDS } from '@jeju/contracts';

if (isValidAddress(address)) {
  // address is typed as Address
}
```

### Direct JSON Imports

```typescript
// Import deployment files directly
import uniswapV4 from '@jeju/contracts/deployments/uniswap-v4-1337.json';
import bazaar from '@jeju/contracts/deployments/bazaar-marketplace-1337.json';

// Import ABIs directly  
import { abi } from '@jeju/contracts/abis/IdentityRegistry.json';
```

## Exports

### ABIs (`@jeju/contracts/abis`)

- `ERC20Abi` - Standard ERC20 token
- `ERC20FactoryAbi` - Token factory contract
- `BazaarAbi` - NFT marketplace
- `IdentityRegistryAbi` - ERC-8004 agent registry

### Deployment Helpers (`@jeju/contracts/deployments`)

- `getContractAddresses(chainId)` - Get all addresses for a chain
- `getContractAddressesByNetwork(network)` - Get addresses by network name
- `getUniswapV4(chainId)` - Uniswap V4 addresses
- `getBazaarMarketplace(chainId)` - Marketplace address
- `getERC20Factory(chainId)` - Token factory address
- `getIdentityRegistry(chainId)` - Identity registry address

### Types

- `ChainId` - 1337 | 420691 | 84532 | 8453
- `NetworkName` - 'localnet' | 'testnet' | 'mainnet'
- `ContractAddresses` - Full address interface
- `UniswapV4Deployment`, `BazaarMarketplaceDeployment`, etc.

### Constants

- `CHAIN_IDS` - Chain ID constants
- `ZERO_ADDRESS` - `0x0000...000`
- `isValidAddress(addr)` - Check if address is valid

---

## Solidity Development

### Setup

```bash
cd packages/contracts
forge install
```

### Build

```bash
forge build
```

### Test

```bash
# All tests
forge test

# Registry tests only
make test-registry

# Specific test
forge test --match-contract IdentityRegistryTest
```

### Deploy

```bash
# Localnet
make deploy-local

# Testnet
export NETWORK=testnet
export DEPLOYER_PRIVATE_KEY=0x...
forge script script/DeployLiquiditySystem.s.sol \
  --rpc-url https://testnet-rpc.jeju.network \
  --broadcast \
  --verify
```

Deployment addresses are saved to `deployments/{network}/`.
