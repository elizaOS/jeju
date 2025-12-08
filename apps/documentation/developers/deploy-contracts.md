# Deploy Contracts

## Localnet

```bash
cd contracts
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:9545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Testnet

```bash
forge script script/Deploy.s.sol --broadcast \
  --rpc-url https://testnet-rpc.jeju.network \
  --private-key $TESTNET_KEY --verify
```

## Mainnet

```bash
forge script script/Deploy.s.sol --broadcast \
  --rpc-url https://rpc.jeju.network \
  --private-key $MAINNET_KEY --verify
```

## Core Deployments

```bash
# Liquidity system
forge script script/DeployLiquiditySystem.s.sol --broadcast

# Node rewards
forge script script/DeployRewards.s.sol --broadcast

# Oracle
forge script script/DeployCrossChainOracle.s.sol --broadcast
```

## Verification

```bash
forge verify-contract \
  --chain-id 420691 \
  --compiler-version v0.8.28 \
  $CONTRACT_ADDRESS src/YourContract.sol:YourContract
```

## TypeScript

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://rpc.jeju.network');
const wallet = new ethers.Wallet(privateKey, provider);
const factory = new ethers.ContractFactory(abi, bytecode, wallet);
const contract = await factory.deploy(...args);
await contract.waitForDeployment();
console.log('Deployed:', await contract.getAddress());
```
