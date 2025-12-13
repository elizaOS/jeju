/**
 * KMS SDK - Encryption Utilities
 *
 * High-level functions for common encryption patterns.
 */

import type { Address } from 'viem';
import { getKMS } from '../kms.js';
import {
  type AccessCondition,
  type AccessControlPolicy,
  type EncryptedPayload,
  ConditionOperator,
  KMSProviderType,
} from '../types.js';

// ============================================================================
// Policy Builders
// ============================================================================

/**
 * Create a time-based access policy
 * Data can be decrypted after the specified timestamp
 */
export function timeLockedPolicy(
  chain: string,
  unlockTimestamp: number
): AccessControlPolicy {
  return {
    conditions: [
      {
        type: 'timestamp',
        chain,
        comparator: ConditionOperator.GREATER_THAN_OR_EQUAL,
        value: unlockTimestamp,
      },
    ],
    operator: 'and',
  };
}

/**
 * Create a stake-based access policy
 * Only users with minimum stake can decrypt
 */
export function stakeGatedPolicy(
  registryAddress: Address,
  chain: string,
  minStakeUSD: number
): AccessControlPolicy {
  return {
    conditions: [
      {
        type: 'stake',
        registryAddress,
        chain,
        minStakeUSD,
      },
    ],
    operator: 'and',
  };
}

/**
 * Create a role-based access policy
 * Only users with specific role can decrypt
 */
export function roleGatedPolicy(
  registryAddress: Address,
  chain: string,
  role: string
): AccessControlPolicy {
  return {
    conditions: [
      {
        type: 'role',
        registryAddress,
        chain,
        role,
      },
    ],
    operator: 'and',
  };
}

/**
 * Create an agent-owner access policy
 * Only the owner of a specific agent can decrypt
 */
export function agentOwnerPolicy(
  registryAddress: Address,
  chain: string,
  agentId: number
): AccessControlPolicy {
  return {
    conditions: [
      {
        type: 'agent',
        registryAddress,
        chain,
        agentId,
      },
    ],
    operator: 'and',
  };
}

/**
 * Create a token balance access policy
 * Only users with minimum token balance can decrypt
 */
export function tokenGatedPolicy(
  chain: string,
  tokenAddress: Address,
  minBalance: string
): AccessControlPolicy {
  return {
    conditions: [
      {
        type: 'balance',
        chain,
        tokenAddress,
        comparator: ConditionOperator.GREATER_THAN_OR_EQUAL,
        value: minBalance,
      },
    ],
    operator: 'and',
  };
}

/**
 * Combine multiple conditions with AND
 */
export function combineAnd(...conditions: AccessCondition[]): AccessControlPolicy {
  return {
    conditions,
    operator: 'and',
  };
}

/**
 * Combine multiple conditions with OR
 */
export function combineOr(...conditions: AccessCondition[]): AccessControlPolicy {
  return {
    conditions,
    operator: 'or',
  };
}

// ============================================================================
// High-Level Encryption Functions
// ============================================================================

/**
 * Encrypt data with time-lock
 * Automatically decryptable after timestamp
 */
export async function encryptTimeLocked(
  data: string,
  chain: string,
  unlockTimestamp: number,
  metadata?: Record<string, string>
): Promise<EncryptedPayload> {
  const kms = getKMS();
  await kms.initialize();

  return kms.encrypt({
    data,
    policy: timeLockedPolicy(chain, unlockTimestamp),
    metadata,
  });
}

/**
 * Encrypt data for stake-holders only
 */
export async function encryptForStakers(
  data: string,
  registryAddress: Address,
  chain: string,
  minStakeUSD: number,
  metadata?: Record<string, string>
): Promise<EncryptedPayload> {
  const kms = getKMS();
  await kms.initialize();

  return kms.encrypt({
    data,
    policy: stakeGatedPolicy(registryAddress, chain, minStakeUSD),
    metadata,
  });
}

/**
 * Encrypt data for specific role holders
 */
export async function encryptForRole(
  data: string,
  registryAddress: Address,
  chain: string,
  role: string,
  metadata?: Record<string, string>
): Promise<EncryptedPayload> {
  const kms = getKMS();
  await kms.initialize();

  return kms.encrypt({
    data,
    policy: roleGatedPolicy(registryAddress, chain, role),
    metadata,
  });
}

/**
 * Encrypt data for agent owner only
 */
export async function encryptForAgent(
  data: string,
  registryAddress: Address,
  chain: string,
  agentId: number,
  metadata?: Record<string, string>
): Promise<EncryptedPayload> {
  const kms = getKMS();
  await kms.initialize();

  return kms.encrypt({
    data,
    policy: agentOwnerPolicy(registryAddress, chain, agentId),
    metadata,
  });
}

/**
 * Encrypt with custom policy
 */
export async function encryptWithPolicy(
  data: string,
  policy: AccessControlPolicy,
  options?: {
    keyId?: string;
    provider?: KMSProviderType;
    metadata?: Record<string, string>;
  }
): Promise<EncryptedPayload> {
  const kms = getKMS();
  await kms.initialize();

  return kms.encrypt(
    {
      data,
      policy,
      keyId: options?.keyId,
      metadata: options?.metadata,
    },
    options?.provider
  );
}

