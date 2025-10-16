import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ChainConfigSchema, type ChainConfig } from '../types/chain';
import type { NetworkType, BaseNetworks } from '../types/config';

const CONFIG_DIR = __dirname;

export function loadChainConfig(network: NetworkType): ChainConfig {
  const configPath = resolve(CONFIG_DIR, `chain/${network}.json`);
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  return ChainConfigSchema.parse(raw);
}

export function loadBaseNetworks(): BaseNetworks {
  const configPath = resolve(CONFIG_DIR, 'base-networks.json');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  return config;
}

export function getChainConfig(network?: NetworkType): ChainConfig {
  const env = process.env.JEJU_NETWORK as NetworkType || network || 'mainnet';
  return loadChainConfig(env);
}

export function getContractAddress(
  network: NetworkType,
  layer: 'l1' | 'l2',
  contractName: string
): string {
  const config = loadChainConfig(network);
  const contracts = layer === 'l1' ? config.contracts.l1 : config.contracts.l2;
  const address = contracts[contractName as keyof typeof contracts];
  
  if (!address) {
    throw new Error(
      `Contract ${contractName} not found on ${layer} for ${network}. ` +
      `Make sure to deploy and update config/chain/${network}.json`
    );
  }
  
  return address;
}

export function getRpcUrl(network?: NetworkType): string {
  const config = getChainConfig(network);
  return process.env.JEJU_RPC_URL || config.rpcUrl;
}

export function getWsUrl(network?: NetworkType): string {
  const config = getChainConfig(network);
  return process.env.JEJU_WS_URL || config.wsUrl;
}

export function getExplorerUrl(network?: NetworkType): string {
  const config = getChainConfig(network);
  return process.env.JEJU_EXPLORER_URL || config.explorerUrl;
}

export function getL1RpcUrl(network?: NetworkType): string {
  const config = getChainConfig(network);
  return process.env.JEJU_L1_RPC_URL || config.l1RpcUrl;
}

export type { ChainConfig, Network } from '../types/chain';
export type { NetworkType, BaseNetworks } from '../types/config';


