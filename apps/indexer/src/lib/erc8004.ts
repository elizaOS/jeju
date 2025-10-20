/**
 * ERC-8004 Registry Integration for Indexer
 * User access control for query services
 */

import { Address, createPublicClient, http, parseAbi } from 'viem';

const JEJU_CHAIN = {
  id: 1337,
  name: 'Jeju L3',
  network: 'jeju',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: [process.env.RPC_URL || 'http://localhost:9545'] },
    public: { http: [process.env.RPC_URL || 'http://localhost:9545'] },
  },
};

const IDENTITY_REGISTRY_ABI = parseAbi([
  'function getAgentId(address agentAddress) external view returns (uint256)',
]);

const BAN_MANAGER_ABI = parseAbi([
  'function isBanned(uint256 agentId) external view returns (bool)',
  'function getBanReason(uint256 agentId) external view returns (string memory)',
]);

const IDENTITY_REGISTRY_ADDRESS = (process.env.IDENTITY_REGISTRY_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as Address;

const BAN_MANAGER_ADDRESS = (process.env.BAN_MANAGER_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as Address;

export interface BanCheckResult {
  allowed: boolean;
  reason?: string;
}

function getPublicClient() {
  return createPublicClient({
    chain: JEJU_CHAIN,
    transport: http(),
  });
}

export async function checkUserBan(userAddress: Address): Promise<BanCheckResult> {
  if (BAN_MANAGER_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return { allowed: true };
  }

  try {
    const client = getPublicClient();
    
    const agentId = await client.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'getAgentId',
      args: [userAddress],
    } as any);

    const isBanned = await client.readContract({
      address: BAN_MANAGER_ADDRESS,
      abi: BAN_MANAGER_ABI,
      functionName: 'isBanned',
      args: [agentId],
    } as any);

    if (isBanned) {
      const reason = await client.readContract({
        address: BAN_MANAGER_ADDRESS,
        abi: BAN_MANAGER_ABI,
        functionName: 'getBanReason',
        args: [agentId],
      } as any);

      return {
        allowed: false,
        reason: reason as string,
      };
    }

    return { allowed: true };
  } catch (error) {
    return { allowed: true };
  }
}

