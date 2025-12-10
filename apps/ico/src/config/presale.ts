import { Address } from 'viem';

export interface PresaleConfig {
  contractAddress: Address;
  tokenAddress: Address;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  
  // Schedule (Unix timestamps)
  whitelistStart: number;
  publicStart: number;
  presaleEnd: number;
  tgeTimestamp: number;
}

// Testnet configuration (Base Sepolia / Jeju Testnet)
export const TESTNET_CONFIG: PresaleConfig = {
  contractAddress: '0x0000000000000000000000000000000000000000' as Address,
  tokenAddress: '0x0000000000000000000000000000000000000000' as Address,
  chainId: 420690,
  rpcUrl: 'https://testnet-rpc.jeju.network',
  blockExplorer: 'https://testnet.jeju.network',
  
  // Demo dates (update when deploying)
  whitelistStart: Math.floor(Date.now() / 1000) + 60, // 1 minute from now
  publicStart: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  presaleEnd: Math.floor(Date.now() / 1000) + 21 * 24 * 60 * 60, // 21 days
  tgeTimestamp: Math.floor(Date.now() / 1000) + 28 * 24 * 60 * 60, // 28 days
};

// Localnet configuration
export const LOCALNET_CONFIG: PresaleConfig = {
  contractAddress: '0x0000000000000000000000000000000000000000' as Address,
  tokenAddress: '0x0000000000000000000000000000000000000000' as Address,
  chainId: 1337,
  rpcUrl: 'http://127.0.0.1:9545',
  blockExplorer: '',
  
  // Local demo dates
  whitelistStart: Math.floor(Date.now() / 1000) + 60,
  publicStart: Math.floor(Date.now() / 1000) + 300,
  presaleEnd: Math.floor(Date.now() / 1000) + 600,
  tgeTimestamp: Math.floor(Date.now() / 1000) + 900,
};

// Get config based on environment
export function getPresaleConfig(): PresaleConfig {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
  
  if (network === 'localnet') {
    return LOCALNET_CONFIG;
  }
  
  return TESTNET_CONFIG;
}

// ABI for the presale contract
export const PRESALE_ABI = [
  {
    name: 'contribute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'refund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'currentPhase',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'getPresaleStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'raised', type: 'uint256' },
      { name: 'participants', type: 'uint256' },
      { name: 'tokensSold', type: 'uint256' },
      { name: 'softCap', type: 'uint256' },
      { name: 'hardCap', type: 'uint256' },
      { name: 'phase', type: 'uint8' },
    ],
  },
  {
    name: 'getContribution',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'ethAmount', type: 'uint256' },
      { name: 'tokenAllocation', type: 'uint256' },
      { name: 'bonusTokens', type: 'uint256' },
      { name: 'claimedTokens', type: 'uint256' },
      { name: 'claimable', type: 'uint256' },
      { name: 'refunded', type: 'bool' },
    ],
  },
  {
    name: 'getTimeInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'whitelistStart', type: 'uint256' },
      { name: 'publicStart', type: 'uint256' },
      { name: 'presaleEnd', type: 'uint256' },
      { name: 'tgeTimestamp', type: 'uint256' },
      { name: 'currentTime', type: 'uint256' },
    ],
  },
  {
    name: 'whitelist',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'config',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'softCap', type: 'uint256' },
      { name: 'hardCap', type: 'uint256' },
      { name: 'minContribution', type: 'uint256' },
      { name: 'maxContribution', type: 'uint256' },
      { name: 'tokenPrice', type: 'uint256' },
      { name: 'whitelistStart', type: 'uint256' },
      { name: 'publicStart', type: 'uint256' },
      { name: 'presaleEnd', type: 'uint256' },
      { name: 'tgeTimestamp', type: 'uint256' },
    ],
  },
] as const;
