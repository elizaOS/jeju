import { createPublicClient, createWalletClient, http, type Address, parseEther, formatEther, type Chain, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const jeju: Chain = {
  id: 420690,
  name: 'Jeju',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.JEJU_RPC_URL || 'http://localhost:8545'] },
  },
  blockExplorers: {
    default: { name: 'Jeju Explorer', url: 'https://explorer.jeju.network' },
  },
};

const FAUCET_CONFIG = {
  cooldownMs: 12 * 60 * 60 * 1000,
  amountPerClaim: parseEther('100'),
  jejuTokenAddress: (process.env.VITE_JEJU_TOKEN_ADDRESS || process.env.JEJU_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  identityRegistryAddress: (process.env.VITE_IDENTITY_REGISTRY_ADDRESS || process.env.IDENTITY_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  faucetPrivateKey: process.env.FAUCET_PRIVATE_KEY,
};

function validateAddress(address: string): address is Address {
  return isAddress(address);
}

// ABIs
const IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
] as const;

// In-memory rate limit store (in production, use Redis)
const claimHistory = new Map<string, number>();

// Clients
const publicClient = createPublicClient({
  chain: jeju,
  transport: http(process.env.JEJU_RPC_URL || 'http://localhost:8545'),
});

function getWalletClient() {
  if (!FAUCET_CONFIG.faucetPrivateKey) {
    throw new Error('FAUCET_PRIVATE_KEY not configured');
  }
  
  const account = privateKeyToAccount(FAUCET_CONFIG.faucetPrivateKey as `0x${string}`);
  
  return createWalletClient({
    account,
    chain: jeju,
    transport: http(process.env.JEJU_RPC_URL || 'http://localhost:8545'),
  });
}

export interface FaucetStatus {
  eligible: boolean;
  isRegistered: boolean;
  cooldownRemaining: number;
  nextClaimAt: number | null;
  amountPerClaim: string;
  faucetBalance: string;
}

export interface FaucetClaimResult {
  success: boolean;
  txHash?: string;
  amount?: string;
  error?: string;
  cooldownRemaining?: number;
}

async function isRegisteredAgent(address: Address): Promise<boolean> {
  if (FAUCET_CONFIG.identityRegistryAddress === '0x0000000000000000000000000000000000000000') {
    // Registry not deployed - for testing, allow all
    return process.env.NODE_ENV === 'test' || process.env.FAUCET_SKIP_REGISTRY === 'true';
  }

  const balance = await publicClient.readContract({
    address: FAUCET_CONFIG.identityRegistryAddress,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'balanceOf',
    args: [address],
  });

  return balance > 0n;
}

function getCooldownRemaining(address: string): number {
  const lastClaim = claimHistory.get(address.toLowerCase());
  if (!lastClaim) return 0;
  
  const elapsed = Date.now() - lastClaim;
  return Math.max(0, FAUCET_CONFIG.cooldownMs - elapsed);
}

async function getFaucetBalance(): Promise<bigint> {
  if (FAUCET_CONFIG.jejuTokenAddress === '0x0000000000000000000000000000000000000000') {
    return 0n;
  }

  if (!FAUCET_CONFIG.faucetPrivateKey) {
    return 0n;
  }

  const account = privateKeyToAccount(FAUCET_CONFIG.faucetPrivateKey as `0x${string}`);
  
  return await publicClient.readContract({
    address: FAUCET_CONFIG.jejuTokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
}

export async function getFaucetStatus(address: Address): Promise<FaucetStatus> {
  if (!validateAddress(address)) {
    return {
      eligible: false,
      isRegistered: false,
      cooldownRemaining: 0,
      nextClaimAt: null,
      amountPerClaim: formatEther(FAUCET_CONFIG.amountPerClaim),
      faucetBalance: '0',
    };
  }

  const isRegistered = await isRegisteredAgent(address);
  const cooldownRemaining = getCooldownRemaining(address);
  const faucetBalance = await getFaucetBalance();
  
  const eligible = isRegistered && cooldownRemaining === 0 && faucetBalance >= FAUCET_CONFIG.amountPerClaim;
  const lastClaim = claimHistory.get(address.toLowerCase());
  
  return {
    eligible,
    isRegistered,
    cooldownRemaining,
    nextClaimAt: lastClaim ? lastClaim + FAUCET_CONFIG.cooldownMs : null,
    amountPerClaim: formatEther(FAUCET_CONFIG.amountPerClaim),
    faucetBalance: formatEther(faucetBalance),
  };
}

export async function claimFromFaucet(address: Address): Promise<FaucetClaimResult> {
  // Validate address format
  if (!validateAddress(address)) {
    return {
      success: false,
      error: 'Invalid wallet address format',
    };
  }

  // Check registration
  const isRegistered = await isRegisteredAgent(address);
  if (!isRegistered) {
    return {
      success: false,
      error: 'Address must be registered in the ERC-8004 Identity Registry to claim from faucet',
    };
  }

  // Check cooldown
  const cooldownRemaining = getCooldownRemaining(address);
  if (cooldownRemaining > 0) {
    return {
      success: false,
      error: 'Faucet cooldown active',
      cooldownRemaining,
    };
  }

  // Check faucet balance
  const faucetBalance = await getFaucetBalance();
  if (faucetBalance < FAUCET_CONFIG.amountPerClaim) {
    return {
      success: false,
      error: 'Faucet is empty, please try again later',
    };
  }

  // Check configuration
  if (FAUCET_CONFIG.jejuTokenAddress === '0x0000000000000000000000000000000000000000') {
    return {
      success: false,
      error: 'JEJU token not configured',
    };
  }

  // Execute transfer
  const walletClient = getWalletClient();
  
  const hash = await walletClient.writeContract({
    address: FAUCET_CONFIG.jejuTokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [address, FAUCET_CONFIG.amountPerClaim],
  });

  // Record claim time
  claimHistory.set(address.toLowerCase(), Date.now());

  return {
    success: true,
    txHash: hash,
    amount: formatEther(FAUCET_CONFIG.amountPerClaim),
  };
}

export function getFaucetInfo() {
  return {
    name: 'Jeju Testnet Faucet',
    description: 'Get JEJU tokens for testing on the Jeju testnet. Requires ERC-8004 registry registration.',
    tokenSymbol: 'JEJU',
    amountPerClaim: formatEther(FAUCET_CONFIG.amountPerClaim),
    cooldownHours: FAUCET_CONFIG.cooldownMs / (60 * 60 * 1000),
    requirements: [
      'Wallet must be registered in ERC-8004 Identity Registry',
      '12 hour cooldown between claims',
    ],
    chainId: 420690,
    chainName: 'Jeju',
  };
}

export const faucetService = {
  getFaucetStatus,
  claimFromFaucet,
  getFaucetInfo,
};
