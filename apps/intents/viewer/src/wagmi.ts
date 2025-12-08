/**
 * @fileoverview Wagmi + RainbowKit configuration for OIF Viewer
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { base, baseSepolia, arbitrum, optimism, mainnet } from 'wagmi/chains';
import type { Chain } from 'wagmi/chains';

// Custom Jeju chain definition
export const jeju: Chain = {
  id: 420690,
  name: 'Jeju',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { 
      http: [import.meta.env.VITE_JEJU_RPC_URL || 'https://rpc.testnet.jeju.network'] 
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: import.meta.env.VITE_JEJU_EXPLORER_URL || 'https://explorer.testnet.jeju.network' },
  },
  testnet: true,
};

// RainbowKit config
export const config = getDefaultConfig({
  appName: 'Jeju Intent Viewer',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'oif-viewer',
  chains: [jeju, baseSepolia, base, arbitrum, optimism, mainnet],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [jeju.id]: http(import.meta.env.VITE_JEJU_RPC_URL || 'https://rpc.testnet.jeju.network'),
  },
});

// OIF Contract addresses per chain (populated from environment)
export const OIF_CONTRACTS = {
  inputSettlers: {
    [jeju.id]: import.meta.env.VITE_OIF_INPUT_SETTLER_420690 as `0x${string}` | undefined,
    [baseSepolia.id]: import.meta.env.VITE_OIF_INPUT_SETTLER_84532 as `0x${string}` | undefined,
    [base.id]: import.meta.env.VITE_OIF_INPUT_SETTLER_8453 as `0x${string}` | undefined,
    [arbitrum.id]: import.meta.env.VITE_OIF_INPUT_SETTLER_42161 as `0x${string}` | undefined,
    [optimism.id]: import.meta.env.VITE_OIF_INPUT_SETTLER_10 as `0x${string}` | undefined,
  },
  outputSettlers: {
    [jeju.id]: import.meta.env.VITE_OIF_OUTPUT_SETTLER_420690 as `0x${string}` | undefined,
    [baseSepolia.id]: import.meta.env.VITE_OIF_OUTPUT_SETTLER_84532 as `0x${string}` | undefined,
    [base.id]: import.meta.env.VITE_OIF_OUTPUT_SETTLER_8453 as `0x${string}` | undefined,
    [arbitrum.id]: import.meta.env.VITE_OIF_OUTPUT_SETTLER_42161 as `0x${string}` | undefined,
    [optimism.id]: import.meta.env.VITE_OIF_OUTPUT_SETTLER_10 as `0x${string}` | undefined,
  },
  solverRegistries: {
    [jeju.id]: import.meta.env.VITE_OIF_SOLVER_REGISTRY_420690 as `0x${string}` | undefined,
    [baseSepolia.id]: import.meta.env.VITE_OIF_SOLVER_REGISTRY_84532 as `0x${string}` | undefined,
    [base.id]: import.meta.env.VITE_OIF_SOLVER_REGISTRY_8453 as `0x${string}` | undefined,
  },
} as const;

// Aggregator URL
export const AGGREGATOR_URL = import.meta.env.VITE_OIF_AGGREGATOR_URL || 'http://localhost:4010';

