/**
 * ERC-8004 Registry Integration for Indexer
 */

import { ethers } from 'ethers';

const IDENTITY_REGISTRY_ABI = [
  'function getAgentId(address agentAddress) external view returns (uint256)',
];

const BAN_MANAGER_ABI = [
  'function isBanned(uint256 agentId) external view returns (bool)',
  'function getBanReason(uint256 agentId) external view returns (string memory)',
];

export interface BanCheckResult {
  allowed: boolean;
  reason?: string;
}

function getProvider() {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('RPC_URL environment variable is required');
  return new ethers.JsonRpcProvider(rpcUrl);
}

export async function checkUserBan(userAddress: string): Promise<BanCheckResult> {
  const banManagerAddress = process.env.BAN_MANAGER_ADDRESS;
  const identityRegistryAddress = process.env.IDENTITY_REGISTRY_ADDRESS;
  
  if (!banManagerAddress || !identityRegistryAddress) {
    return { allowed: true };
  }

  const provider = getProvider();
  
  const identityRegistry = new ethers.Contract(identityRegistryAddress, IDENTITY_REGISTRY_ABI, provider);
  const banManager = new ethers.Contract(banManagerAddress, BAN_MANAGER_ABI, provider);

  const agentId = await identityRegistry.getAgentId(userAddress);
  const isBanned = await banManager.isBanned(agentId);

  if (isBanned) {
    const reason = await banManager.getBanReason(agentId);
    return { allowed: false, reason };
  }

  return { allowed: true };
}
