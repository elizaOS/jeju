# Contract Addresses

## L3 Predeploys (on Jeju)

Standard OP-Stack addresses:

```typescript
// Bridge & Messaging
L2CrossDomainMessenger: '0x4200000000000000000000000000000000000007'
L2StandardBridge:       '0x4200000000000000000000000000000000000010'
L2ERC721Bridge:         '0x4200000000000000000000000000000000000014'
L2ToL1MessagePasser:    '0x4200000000000000000000000000000000000016'

// System
GasPriceOracle:         '0x420000000000000000000000000000000000000F'
L1Block:                '0x4200000000000000000000000000000000000015'
SequencerFeeVault:      '0x4200000000000000000000000000000000000011'
BaseFeeVault:           '0x4200000000000000000000000000000000000019'
L1FeeVault:             '0x420000000000000000000000000000000000001A'

// Utilities
WETH:                   '0x4200000000000000000000000000000000000006'
OptimismMintableERC20Factory: '0x4200000000000000000000000000000000000012'
OptimismMintableERC721Factory: '0x4200000000000000000000000000000000000017'
Multicall3:             '0xcA11bde05977b3631167028862bE2a173976CA11'
```

## L1 Contracts (on Base)

Deployed addresses saved to `contracts/deployments/{network}/l1-contracts.json` after running deployment scripts.

## Infrastructure

```typescript
// ERC-4337
EntryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'  // v0.6 standard

// Uniswap V4 (localnet)
PoolManager: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
```

## Usage

### Ethers.js
```typescript
const provider = new ethers.JsonRpcProvider('https://rpc.jeju.network');
const bridge = new ethers.Contract(
  '0x4200000000000000000000000000000000000010',
  L2StandardBridgeABI,
  provider
);
```

### Viem
```typescript
const client = createPublicClient({ chain: jeju, transport: http() });
const balance = await client.readContract({
  address: '0x4200000000000000000000000000000000000010',
  abi: L2StandardBridgeABI,
  functionName: 'balanceOf',
  args: [address],
});
```

## ABIs

Available at `contracts/out/` in the repo or download from block explorer.
