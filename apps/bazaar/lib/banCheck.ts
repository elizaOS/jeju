import { Address, createPublicClient, http, PublicClient } from 'viem';
import { jeju } from '../config/chains';

const BAN_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_BAN_MANAGER_ADDRESS as Address | undefined;
const IDENTITY_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS as Address | undefined;
const BAZAAR_APP_ID = `0x${Buffer.from('bazaar').toString('hex').padStart(64, '0')}` as `0x${string}`;

const banCache = new Map<string, { banned: boolean; reason?: string; cachedAt: number }>();
const CACHE_TTL = 10000;

export interface BanCheckResult {
  allowed: boolean
  reason?: string
  networkBanned?: boolean
  appBanned?: boolean
  labels?: string[]
}

const BAN_MANAGER_ABI = [
  {
    name: 'isAccessAllowed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'appId', type: 'bytes32' },
    ],
    outputs: [{ name: 'allowed', type: 'bool' }],
  },
  {
    name: 'isNetworkBanned',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getBanReason',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'appId', type: 'bytes32' },
    ],
    outputs: [{ name: 'reason', type: 'string' }],
  },
] as const;

const IDENTITY_REGISTRY_ABI = [
  {
    name: 'addressToAgentId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'entity', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const publicClient = createPublicClient({
  chain: jeju,
  transport: http(),
});

export async function checkUserBan(userAddress: Address): Promise<BanCheckResult> {
  if (!BAN_MANAGER_ADDRESS || !IDENTITY_REGISTRY_ADDRESS) {
    return { allowed: true };
  }

  const cacheKey = userAddress.toLowerCase();
  const cached = banCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return { allowed: !cached.banned, reason: cached.reason, networkBanned: cached.banned };
  }

  const agentId = await publicClient.readContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'addressToAgentId',
    args: [userAddress],
  });

  if (!agentId || agentId === 0n) {
    return { allowed: true };
  }

  const allowed = await publicClient.readContract({
    address: BAN_MANAGER_ADDRESS,
    abi: BAN_MANAGER_ABI,
    functionName: 'isAccessAllowed',
    args: [agentId, BAZAAR_APP_ID],
  });

  if (allowed) {
    banCache.set(cacheKey, { banned: false, cachedAt: Date.now() });
    return { allowed: true };
  }

  const isNetworkBanned = await publicClient.readContract({
    address: BAN_MANAGER_ADDRESS,
    abi: BAN_MANAGER_ABI,
    functionName: 'isNetworkBanned',
    args: [agentId],
  });

  const reason = await publicClient.readContract({
    address: BAN_MANAGER_ADDRESS,
    abi: BAN_MANAGER_ABI,
    functionName: 'getBanReason',
    args: [agentId, isNetworkBanned ? '0x0000000000000000000000000000000000000000000000000000000000000000' : BAZAAR_APP_ID],
  });

  banCache.set(cacheKey, { banned: true, reason: reason || undefined, cachedAt: Date.now() });

  return { allowed: false, reason: reason || 'Banned', networkBanned: isNetworkBanned, appBanned: !isNetworkBanned };
}

export async function checkTradeAllowed(userAddress: Address): Promise<boolean> {
  const result = await checkUserBan(userAddress);
  return result.allowed;
}


