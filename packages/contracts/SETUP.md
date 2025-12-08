# Quick Setup Guide

## 1. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## 2. Install Dependencies

```bash
cd contracts
make install
```

This will install:
- ✅ forge-std (Foundry standard library)
- ✅ openzeppelin-contracts (OpenZeppelin)
- ✅ openzeppelin-contracts-upgradeable
- ✅ optimism (OP-Stack contracts)

## 3. Configure Environment

```bash
cp .env.example .env
vim .env
```

Set:
- `DEPLOYER_PRIVATE_KEY` - Your deployer key
- `BASE_SEPOLIA_RPC_URL` - Base Sepolia RPC
- `BASESCAN_API_KEY` - For contract verification

## 4. Test Setup

```bash
forge build
forge test
```

Should see:
```
[⠒] Compiling...
[⠢] Compiling 1 files with 0.8.25
[⠆] Solc 0.8.25 finished in 1.23s
Compiler run successful!

Running 3 tests for test/Deploy.t.sol:DeployTest
[PASS] testFoundrySetup() (gas: 165)
[PASS] testDeployerHasBalance() (gas: 7621)
[PASS] testCanDeployContract() (gas: 67890)
Test result: ok. 3 passed; 0 failed; finished in 1.23ms
```

## 5. Deploy

### Testnet (Base Sepolia)
```bash
make deploy-testnet
make genesis-testnet
```

### Mainnet (Base)
```bash
make deploy-mainnet
make genesis-mainnet
```

## Troubleshooting

### "Command not found: forge"
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### "Library not found"
```bash
make install
```

### "RPC URL not set"
```bash
# Check .env file
cat .env

# Or set manually
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
```

## Next Steps

After deployment:
1. Save addresses to `deployments/<network>/addresses.json`
2. Update `packages/config/chain/<network>.json`
3. Deploy infrastructure: `bun run start`


