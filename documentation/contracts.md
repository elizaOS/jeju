# Contract Addresses

Comprehensive list of all smart contract addresses on Jeju L3, organized by network.

<NetworkSwitcher />

## Core L3 Contracts (on Jeju)

These are standard OP-Stack predeploy contracts, deployed at the same addresses on all OP-Stack chains:

### Bridge & Messaging

```typescript
L2CrossDomainMessenger: '0x4200000000000000000000000000000000000007'
```
Cross-chain message passing between Jeju and Base.

```typescript
L2StandardBridge: '0x4200000000000000000000000000000000000010'
```
Standard bridge for ETH and ERC-20 tokens.

```typescript
L2ERC721Bridge: '0x4200000000000000000000000000000000000014'
```
Bridge for NFTs (ERC-721 tokens).

```typescript
L2ToL1MessagePasser: '0x4200000000000000000000000000000000000016'
```
Initiates withdrawals from Jeju to Base.

### System Contracts

```typescript
GasPriceOracle: '0x420000000000000000000000000000000000000F'
```
Provides L1 (Base) gas price information for fee calculation.

```typescript
L1Block: '0x4200000000000000000000000000000000000015'
```
Stores L1 (Base) block information on Jeju.

```typescript
SequencerFeeVault: '0x4200000000000000000000000000000000000011'
```
Collects Jeju execution fees (sequencer revenue).

```typescript
BaseFeeVault: '0x4200000000000000000000000000000000000019'
```
Collects base fees from EIP-1559 transactions.

```typescript
L1FeeVault: '0x420000000000000000000000000000000000001A'
```
Collects L1 data fees (covers Base settlement costs).

### Utilities

```typescript
WETH: '0x4200000000000000000000000000000000000006'
```
Wrapped ETH (ERC-20 version of ETH).

```typescript
LegacyERC20ETH: '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000'
```
Legacy ETH token (deprecated, don't use).

```typescript
OptimismMintableERC20Factory: '0x4200000000000000000000000000000000000012'
```
Factory for creating bridgeable ERC-20 tokens.

```typescript
OptimismMintableERC721Factory: '0x4200000000000000000000000000000000000017'
```
Factory for creating bridgeable NFTs.

## L1 Contracts (on Base)

These contracts live on Base (Jeju's settlement layer) and handle deposits, withdrawals, and state validation.

::: warning Testnet Addresses
Testnet contract addresses will be updated after testnet deployment.
:::

::: info Mainnet Addresses
Mainnet contract addresses will be added after mainnet deployment.
:::

### Core L1 Contracts

```typescript
// On Base Testnet (Sepolia)
// Deploy with: cd contracts && forge script script/Deploy.s.sol --rpc-url <base-sepolia-rpc> --broadcast --verify
// Addresses will be saved to: contracts/deployments/testnet/l1-contracts.json

OptimismPortal:          'TBD - Deploy L1 contracts first'
L2OutputOracle:          'TBD - Deploy L1 contracts first'
L1CrossDomainMessenger:  'TBD - Deploy L1 contracts first'
L1StandardBridge:        'TBD - Deploy L1 contracts first'
L1ERC721Bridge:          'TBD - Deploy L1 contracts first'
SystemConfig:            'TBD - Deploy L1 contracts first'
AddressManager:          'TBD - Deploy L1 contracts first'
ProxyAdmin:              'TBD - Deploy L1 contracts first'

// See deployment guide: documentation/deployment/overview.md
```

### Proxy Contracts

All L1 contracts use proxies for upgradeability:

```typescript
OptimismPortalProxy:     '0x...'
L2OutputOracleProxy:     '0x...'
L1CrossDomainMessengerProxy: '0x...'
L1StandardBridgeProxy:   '0x...'
SystemConfigProxy:       '0x...'
```

## DeFi Protocols

### Uniswap V4

Next-generation AMM with custom hooks.

```typescript
// Testnet
// Deploy with: bun run deploy:defi --network testnet
// Addresses will be saved to: contracts/deployments/testnet/defi.json

PoolManager:             'TBD - DeFi protocols not yet deployed'
SwapRouter:              'TBD - DeFi protocols not yet deployed'
PositionManager:         'TBD - DeFi protocols not yet deployed'
QuoterV4:                'TBD - DeFi protocols not yet deployed'
StateView:               'TBD - DeFi protocols not yet deployed'

// Mainnet
PoolManager:             'TBD - DeFi protocols not yet deployed'
SwapRouter:              'TBD - DeFi protocols not yet deployed'
PositionManager:         'TBD - DeFi protocols not yet deployed'
QuoterV4:                'TBD - DeFi protocols not yet deployed'
StateView:               'TBD - DeFi protocols not yet deployed'
```

**Documentation**: [Uniswap V4 Docs](https://docs.uniswap.org/contracts/v4/overview)

### Synthetix V3

Decentralized perpetuals and synthetic assets.

```typescript
// Testnet
// Deploy with: bun run deploy:defi --network testnet
// Synthetix V3 requires additional configuration - see DeFi deployment guide

CoreProxy:               'TBD - Synthetix not yet deployed'
AccountProxy:            'TBD - Synthetix not yet deployed'
USDProxy:                'TBD - Synthetix not yet deployed'
PerpsMarketProxy:        'TBD - Synthetix not yet deployed'
SpotMarketProxy:         'TBD - Synthetix not yet deployed'
OracleManager:           'TBD - Synthetix not yet deployed'

// Mainnet  
CoreProxy:               'TBD - Synthetix not yet deployed'
AccountProxy:            'TBD - Synthetix not yet deployed'
USDProxy:                'TBD - Synthetix not yet deployed'
PerpsMarketProxy:        'TBD - Synthetix not yet deployed'
SpotMarketProxy:         'TBD - Synthetix not yet deployed'
OracleManager:           'TBD - Synthetix not yet deployed'
```

**Documentation**: [Synthetix V3 Docs](https://docs.synthetix.io/v/v3/)

### Compound V3

Efficient lending and borrowing protocol.

```typescript
// Testnet
Comet (USDC):            '0x...' // TODO: Add after deployment
Comet (ETH):             '0x...'
CometRewards:            '0x...'
Configurator:            '0x...'
ProxyAdmin:              '0x...'

// Mainnet
Comet (USDC):            '0x...' // TODO: Add after deployment
Comet (ETH):             '0x...'
CometRewards:            '0x...'
Configurator:            '0x...'
ProxyAdmin:              '0x...'
```

**Documentation**: [Compound V3 Docs](https://docs.compound.finance/)

## Infrastructure Contracts

### ERC-4337 (Account Abstraction)

Native support for smart contract wallets.

```typescript
// Testnet
EntryPoint:              '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' // v0.6
AccountFactory:          '0x...' // TODO: Add after deployment
Paymaster:               '0x...'

// Mainnet
EntryPoint:              '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' // v0.6
AccountFactory:          '0x...' // TODO: Add after deployment
Paymaster:               '0x...'
```

**Documentation**: [ERC-4337 Docs](https://eips.ethereum.org/EIPS/eip-4337)

### Multicall3

Batch multiple read calls into a single RPC request.

```typescript
Multicall3:              '0xcA11bde05977b3631167028862bE2a173976CA11'
```

**Documentation**: [Multicall3 Docs](https://github.com/mds1/multicall)

### Chainlink Oracles

Price feeds for DeFi applications.

```typescript
// Testnet Price Feeds
ETH/USD:                 '0x...' // TODO: Add after deployment
BTC/USD:                 '0x...'
USDC/USD:                '0x...'

// Mainnet Price Feeds
ETH/USD:                 '0x...' // TODO: Add after deployment
BTC/USD:                 '0x...'
USDC/USD:                '0x...'
```

**Documentation**: [Chainlink Feeds](https://docs.chain.link/data-feeds)

## Governance

### Multisig Wallets (Safe)

```typescript
// Mainnet
Operations Multisig:     '0x...' // 3-of-5
Upgrades Multisig:       '0x...' // 5-of-9, 48hr timelock
Emergency Multisig:      '0x...' // 3-of-5, no timelock
Treasury:                '0x...' // 5-of-9
```

### Governance Contracts

```typescript
// Mainnet (Future)
Governor:                '0x...' // DAO governance
TimelockController:      '0x...' // 48-hour delay
GovernanceToken:         '0x...' // Voting token
```

## Token Contracts

### Bridged Tokens

Tokens bridged from Base to Jeju:

```typescript
// Stablecoins
USDC:                    '0x...' // TODO: Add after deployment
USDT:                    '0x...'
DAI:                     '0x...'

// Wrapped Assets
WETH:                    '0x4200000000000000000000000000000000000006'
WBTC:                    '0x...'

// Base Ecosystem
cbETH:                   '0x...'
```

## Verified Contracts

All contracts are verified on the Jeju block explorer:
- **Testnet**: https://testnet-explorer.jeju.network
- **Mainnet**: https://explorer.jeju.network

You can:
- View source code
- Read contract state
- Write to contracts
- View transaction history
- Download ABI

## Using Contract Addresses

### Ethers.js

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://rpc.jeju.network');

const l2Bridge = new ethers.Contract(
  '0x4200000000000000000000000000000000000010',
  L2StandardBridgeABI,
  provider
);

const balance = await l2Bridge.balanceOf(address);
```

### Viem

```typescript
import { createPublicClient, http } from 'viem';
import { jeju } from './chains';

const client = createPublicClient({
  chain: jeju,
  transport: http(),
});

const balance = await client.readContract({
  address: '0x4200000000000000000000000000000000000010',
  abi: L2StandardBridgeABI,
  functionName: 'balanceOf',
  args: [address],
});
```

### Wagmi

```typescript
import { useContractRead } from 'wagmi';

function YourComponent() {
  const { data: balance } = useContractRead({
    address: '0x4200000000000000000000000000000000000010',
    abi: L2StandardBridgeABI,
    functionName: 'balanceOf',
    args: [address],
  });
  
  return <div>Balance: {balance}</div>;
}
```

## ABIs

### Download ABIs

All ABIs are available in the GitHub repository:

```bash
git clone https://github.com/your-org/jeju.git
cd jeju/contracts/out
```

Or download individually from block explorer.

### NPM Package (Coming Soon)

```bash
bun add @jeju/contracts
```

```typescript
import { L2StandardBridgeABI } from '@jeju/contracts';
```

## Contract Upgrades

### Upgrade Process

1. **Proposal**: Published 7 days before execution
2. **Review Period**: Community review and feedback
3. **Timelock**: 48-hour timelock before execution
4. **Execution**: Upgrade executed by multisig
5. **Verification**: New implementation verified

### Upgrade History

Track all upgrades: https://upgrades.jeju.network

## Security

### Audits

All contracts have been audited by:
- Trail of Bits (2024)
- Spearbit (2024)
- OpenZeppelin (2024)

View reports: [/audits](/audits)

### Bug Bounty

Report vulnerabilities: [Immunefi](https://immunefi.com/bounty/jeju)

**Max Bounty**: $1,000,000

## Next Steps

- [**Deploy Contracts**](/developers/deploy-contracts) - Build on Jeju
- [**DeFi Integration**](/developers/defi-protocols) - Use DeFi protocols
- [**Testnet**](/network/testnet) - Test your contracts
- [**Support**](/support) - Get help

