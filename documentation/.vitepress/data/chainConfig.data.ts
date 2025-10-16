import { readFileSync } from 'fs';
import { resolve } from 'path';

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
  gasToken: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: {
    l2: Record<string, string>;
    l1: Record<string, string>;
  };
}

export interface ChainConfigs {
  mainnet: ChainConfig;
  testnet: ChainConfig;
}

export default {
  load(): ChainConfigs {
    const mainnetPath = resolve(__dirname, '../../../config/chain/mainnet.json');
    const testnetPath = resolve(__dirname, '../../../config/chain/testnet.json');

    const mainnet: ChainConfig = JSON.parse(readFileSync(mainnetPath, 'utf-8'));
    const testnet: ChainConfig = JSON.parse(readFileSync(testnetPath, 'utf-8'));

    return {
      mainnet,
      testnet,
    };
  },
};


