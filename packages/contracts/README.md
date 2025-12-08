# Contracts

Smart contracts for Jeju Network. Includes paymaster, liquidity, oracles, and ERC-8004 registry.

## Setup

```bash
cd contracts
forge install
```

## Build

```bash
forge build
```

## Test

```bash
# All tests (173 tests)
forge test

# Registry tests only (73 tests)
make test-registry

# Specific test
forge test --match-contract IdentityRegistryTest
```

## Deploy

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

# Mainnet
export NETWORK=mainnet
export DEPLOYER_PRIVATE_KEY=0x...
forge script script/DeployLiquiditySystem.s.sol \
  --rpc-url https://rpc.jeju.network \
  --broadcast \
  --verify
```

Deployment addresses saved to `deployments/{network}/liquidity-system.json`
