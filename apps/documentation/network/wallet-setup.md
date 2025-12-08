# Wallet Setup

## MetaMask

### Auto Setup

- Testnet: [chainlist.org/chain/420690](https://chainlist.org/chain/420690)
- Mainnet: [chainlist.org/chain/420691](https://chainlist.org/chain/420691)

### Manual

Networks → Add Network → Add Manually:

**Testnet**:
```
Name: Jeju Testnet
RPC: https://testnet-rpc.jeju.network
Chain ID: 420690
Symbol: ETH
Explorer: https://testnet-explorer.jeju.network
```

**Mainnet**:
```
Name: Jeju
RPC: https://rpc.jeju.network
Chain ID: 420691
Symbol: ETH
Explorer: https://explorer.jeju.network
```

## Hardware Wallets

Ledger/Trezor work via MetaMask or Frame. May show "Unknown chain" warning - safe to ignore.

## Safe (Multisig)

- Testnet: https://testnet-safe.jeju.network
- Mainnet: https://safe.jeju.network

## ERC-4337 (Account Abstraction)

Native support for smart wallets:
- Gasless via paymasters
- Social recovery
- Batch operations

Supported: Stackup, Biconomy, Alchemy Account Kit

## Programmatic

```typescript
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x66B53', // 420691
    chainName: 'Jeju',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.jeju.network'],
    blockExplorerUrls: ['https://explorer.jeju.network'],
  }],
});
```

## Troubleshooting

**Wrong network**: Switch network in wallet, refresh page

**Tx stuck**: Send 0 ETH to yourself with same nonce + higher gas

**Need ETH**: Faucet (testnet) or bridge from Base (mainnet)

**Tokens not showing**: Import token with contract address from explorer
