/**
 * @fileoverview Contract interaction helpers for testing
 * @module gateway/tests/fixtures/contracts
 */

import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const TEST_WALLET = {
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`,
};

const jejuLocalnet = {
  id: 1337,
  name: 'Jeju Localnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:9545'] },
    public: { http: ['http://127.0.0.1:9545'] },
  },
} as const;

export function getPublicClient() {
  return createPublicClient({
    chain: jejuLocalnet,
    transport: http(),
  });
}

export function getWalletClient(privateKey: string = TEST_WALLET.privateKey) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  return createWalletClient({
    account,
    chain: jejuLocalnet,
    transport: http(),
  });
}

function loadDeployments(): Record<string, string> {
  const basePath = join(process.cwd(), '../../contracts/deployments');
  const paths = [
    join(basePath, 'paymaster-system-localnet.json'),
    join(basePath, 'multi-token-system-1337.json'),
    join(basePath, 'identity-system-1337.json'),
    join(basePath, 'localnet-addresses.json'),
  ];

  const deployments: Record<string, string> = {};
  
  for (const path of paths) {
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      Object.assign(deployments, data);
    }
  }

  return deployments;
}

async function isContractDeployed(client: ReturnType<typeof getPublicClient>, address: string | undefined): Promise<boolean> {
  if (!address || address === '0x' || address === '0x0000000000000000000000000000000000000000') {
    return false;
  }
  const code = await client.getCode({ address: address as `0x${string}` });
  return code !== undefined && code !== '0x';
}

export async function getContractAddresses() {
  const deployments = loadDeployments();
  const client = getPublicClient();

  const tokenRegistryAddr = (process.env.VITE_TOKEN_REGISTRY_ADDRESS || deployments.tokenRegistry || deployments.validationRegistry) as `0x${string}`;
  const paymasterFactoryAddr = (process.env.VITE_PAYMASTER_FACTORY_ADDRESS || deployments.paymasterFactory) as `0x${string}`;
  const priceOracleAddr = (process.env.VITE_PRICE_ORACLE_ADDRESS || deployments.Oracle || deployments.oracle || deployments.priceOracle) as `0x${string}`;
  const nodeStakingManagerAddr = (process.env.VITE_NODE_STAKING_MANAGER_ADDRESS || deployments.nodeStakingManager) as `0x${string}`;
  const identityRegistryAddr = (process.env.VITE_IDENTITY_REGISTRY_ADDRESS || deployments.IdentityRegistry || deployments.identityRegistry) as `0x${string}`;

  return {
    tokenRegistry: await isContractDeployed(client, tokenRegistryAddr) ? tokenRegistryAddr : undefined as unknown as `0x${string}`,
    paymasterFactory: await isContractDeployed(client, paymasterFactoryAddr) ? paymasterFactoryAddr : undefined as unknown as `0x${string}`,
    priceOracle: await isContractDeployed(client, priceOracleAddr) ? priceOracleAddr : undefined as unknown as `0x${string}`,
    nodeStakingManager: await isContractDeployed(client, nodeStakingManagerAddr) ? nodeStakingManagerAddr : undefined as unknown as `0x${string}`,
    identityRegistry: await isContractDeployed(client, identityRegistryAddr) ? identityRegistryAddr : undefined as unknown as `0x${string}`,
    elizaOS: (deployments.elizaOS || deployments['elizaOS']) as `0x${string}`,
    entryPoint: (deployments.EntryPoint || deployments.entryPoint) as `0x${string}`,
    paymaster: deployments.Paymaster as `0x${string}`,
    vault: deployments.Vault as `0x${string}`,
  };
}

export async function fundAccount(address: `0x${string}`, amount: bigint = parseEther('10')) {
  const client = getWalletClient();
  
  await client.sendTransaction({
    to: address,
    value: amount,
  });
}

