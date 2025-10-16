# Configuration Files

This directory contains network configuration files that are used throughout the project, including in the documentation.

## Structure

```
config/
├── base-networks.json      # Base L2 network configurations (Sepolia & Mainnet)
└── chain/
    ├── mainnet.json        # Jeju mainnet configuration
    ├── testnet.json        # Jeju testnet configuration
    └── localnet.json       # Local development configuration
```

## Configuration Format

Each chain configuration file (`mainnet.json`, `testnet.json`) follows this structure:

```json
{
  "chainId": 8888,
  "networkId": 8888,
  "name": "Jeju",
  "rpcUrl": "https://rpc.jeju.network",
  "wsUrl": "wss://ws.jeju.network",
  "explorerUrl": "https://explorer.jeju.network",
  "l1ChainId": 8453,
  "l1RpcUrl": "https://mainnet.base.org",
  "l1Name": "Base",
  "flashblocksEnabled": true,
  "flashblocksSubBlockTime": 200,
  "blockTime": 2000,
  "gasToken": {
    "name": "Ether",
    "symbol": "ETH",
    "decimals": 18
  },
  "contracts": {
    "l2": {
      "L2CrossDomainMessenger": "0x4200000000000000000000000000000000000007",
      "L2StandardBridge": "0x4200000000000000000000000000000000000010",
      "L2ToL1MessagePasser": "0x4200000000000000000000000000000000000016",
      "L2ERC721Bridge": "0x4200000000000000000000000000000000000014",
      "GasPriceOracle": "0x420000000000000000000000000000000000000F",
      "L1Block": "0x4200000000000000000000000000000000000015",
      "WETH": "0x4200000000000000000000000000000000000006"
    },
    "l1": {
      "OptimismPortal": "",
      "L2OutputOracle": "",
      "L1CrossDomainMessenger": "",
      "L1StandardBridge": "",
      "SystemConfig": ""
    }
  }
}
```

## Setting Contract Addresses

### L2 Contracts (Predeploys)

L2 contracts are **predeploys** at fixed addresses on all OP-Stack chains. These addresses are the same across mainnet, testnet, and localnet:

- `L2CrossDomainMessenger`: `0x4200000000000000000000000000000000000007`
- `L2StandardBridge`: `0x4200000000000000000000000000000000000010`
- `L2ToL1MessagePasser`: `0x4200000000000000000000000000000000000016`
- `L2ERC721Bridge`: `0x4200000000000000000000000000000000000014`
- `GasPriceOracle`: `0x420000000000000000000000000000000000000F`
- `L1Block`: `0x4200000000000000000000000000000000000015`
- `WETH`: `0x4200000000000000000000000000000000000006`

### L1 Contracts (Deployment-specific)

L1 contracts are deployed on Base (L1) during chain deployment. After deploying to mainnet or testnet, update these addresses:

1. Deploy your OP-Stack contracts to Base using the deployment script
2. Copy the deployed contract addresses
3. Update the `contracts.l1` section in the appropriate config file:

**For testnet:**
```bash
# After testnet deployment
vim config/chain/testnet.json
# Update contracts.l1 addresses
```

**For mainnet:**
```bash
# After mainnet deployment
vim config/chain/mainnet.json
# Update contracts.l1 addresses
```

## Environment Variables

You can also override configuration values using environment variables:

```bash
# Network URLs
export JEJU_RPC_URL="https://rpc.jeju.network"
export JEJU_WS_URL="wss://ws.jeju.network"
export JEJU_EXPLORER_URL="https://explorer.jeju.network"

# L1 Settlement
export JEJU_L1_RPC_URL="https://mainnet.base.org"

# Contract Addresses (L1)
export JEJU_L1_OPTIMISM_PORTAL="0x..."
export JEJU_L1_L2_OUTPUT_ORACLE="0x..."
export JEJU_L1_CROSS_DOMAIN_MESSENGER="0x..."
export JEJU_L1_STANDARD_BRIDGE="0x..."
export JEJU_L1_SYSTEM_CONFIG="0x..."
```

## Deployment Workflow

### 1. Deploy Testnet

```bash
# Deploy OP-Stack contracts to Base Sepolia
bun run scripts/deploy/testnet.ts

# Copy output addresses to config
vim config/chain/testnet.json
# Update contracts.l1 section with deployed addresses

# Documentation will automatically display the new addresses
```

### 2. Deploy Mainnet

```bash
# Deploy OP-Stack contracts to Base Mainnet
bun run scripts/deploy/mainnet.ts

# Update mainnet config
vim config/chain/mainnet.json
# Update contracts.l1 section with deployed addresses

# Rebuild documentation to show mainnet addresses
cd documentation
bun run docs:build
```

## Documentation Integration

The configuration files are automatically loaded into the documentation using VitePress data loaders:

- **File**: `documentation/.vitepress/data/chainConfig.data.ts`
- **Components**: 
  - `ContractAddresses.vue` - Displays contract addresses with copy buttons
  - `NetworkInfo.vue` - Displays network details
  - `NetworkSwitcher.vue` - Switches between mainnet/testnet

When you update the JSON config files, the documentation will automatically reflect the changes on the next build.

## Adding New Contracts

To add new contract addresses to the documentation:

1. Add the contract to the appropriate section in the config file:

```json
{
  "contracts": {
    "l2": {
      // ... existing contracts
      "NewContract": "0x..."
    }
  }
}
```

2. The `ContractAddresses` component will automatically display it.

For DeFi protocols and custom contracts, consider creating a separate `config/contracts/` directory with protocol-specific configs.

## Validation

Before committing changes, validate your JSON files:

```bash
# Check JSON syntax
bun run scripts/validate-config.ts

# Or manually
cat config/chain/mainnet.json | jq '.'
```

## Best Practices

1. **Never commit private keys or secrets** to config files
2. **Empty strings for undeployed contracts** - Use `""` for L1 contracts that haven't been deployed yet
3. **Use environment variables** for sensitive data
4. **Test changes locally** before deploying
5. **Keep testnet and mainnet configs in sync** (except for addresses and URLs)
6. **Document custom fields** if you add new configuration options

## Support

For questions about configuration:
- Discord: #dev-support
- GitHub: Open an issue
- Docs: https://docs.jeju.network


