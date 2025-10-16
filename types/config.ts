export interface GasToken {
  name: string;
  symbol: string;
  decimals: number;
}

export interface L2Contracts {
  L2CrossDomainMessenger: string;
  L2StandardBridge: string;
  L2ToL1MessagePasser: string;
  L2ERC721Bridge: string;
  GasPriceOracle: string;
  L1Block: string;
  WETH: string;
}

export interface L1Contracts {
  OptimismPortal: string;
  L2OutputOracle: string;
  L1CrossDomainMessenger: string;
  L1StandardBridge: string;
  SystemConfig: string;
}

export interface ChainContracts {
  l2: L2Contracts;
  l1: L1Contracts;
}

export interface ChainConfig {
  chainId: number;
  networkId: number;
  name: string;
  rpcUrl: string;
  wsUrl: string;
  explorerUrl: string;
  l1ChainId: number;
  l1RpcUrl: string;
  l1Name: string;
  flashblocksEnabled: boolean;
  flashblocksSubBlockTime: number;
  blockTime: number;
  gasToken: GasToken;
  contracts: ChainContracts;
}

export type NetworkType = 'mainnet' | 'testnet' | 'localnet';

export interface NetworkConfig {
  mainnet: ChainConfig;
  testnet: ChainConfig;
  localnet: ChainConfig;
}

export interface BaseNetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  wsUrl: string;
  explorerUrl: string;
  faucetUrl?: string;
  bridgeUrl?: string;
  isTestnet: boolean;
  nativeCurrency: GasToken;
  blockTime: number;
  gasPrice?: {
    average: string;
    fast: string;
  };
  tvl?: string;
  operator?: string;
  superchain?: boolean;
  costPerTransaction?: string;
  notes?: string;
}

export interface BaseNetworks {
  'base-sepolia': BaseNetworkConfig;
  'base-mainnet': BaseNetworkConfig;
}


