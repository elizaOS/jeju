/**
 * KMS SDK - Decryption Utilities
 *
 * High-level functions for decryption with authentication.
 */

import type { Address, Hex } from 'viem';
import { getKMS } from '../kms.js';
import type { AuthSignature, EncryptedPayload } from '../types.js';

// ============================================================================
// Auth Signature Helpers
// ============================================================================

/**
 * Create an auth signature from a wallet signature
 */
export function createAuthSig(
  signature: Hex,
  message: string,
  address: Address,
  derivedVia: AuthSignature['derivedVia'] = 'web3.eth.personal.sign'
): AuthSignature {
  return {
    sig: signature,
    derivedVia,
    signedMessage: message,
    address,
  };
}

/**
 * Create a SIWE-based auth signature
 */
export function createSIWEAuthSig(
  signature: Hex,
  siweMessage: string,
  address: Address
): AuthSignature {
  return {
    sig: signature,
    derivedVia: 'siwe',
    signedMessage: siweMessage,
    address,
  };
}

// ============================================================================
// High-Level Decryption Functions
// ============================================================================

/**
 * Decrypt with auth signature
 */
export async function decrypt(
  payload: EncryptedPayload,
  authSig: AuthSignature
): Promise<string> {
  const kms = getKMS();
  await kms.initialize();

  return kms.decrypt({
    payload,
    authSig,
  });
}

/**
 * Decrypt without auth (for fallback-encrypted or time-unlocked data)
 */
export async function decryptPublic(payload: EncryptedPayload): Promise<string> {
  const kms = getKMS();
  await kms.initialize();

  return kms.decrypt({ payload });
}

/**
 * Check if payload can be decrypted (access conditions met)
 */
export async function canDecrypt(payload: EncryptedPayload): Promise<boolean> {
  // Check time-based conditions
  const now = Math.floor(Date.now() / 1000);

  for (const condition of payload.policy.conditions) {
    if (condition.type === 'timestamp') {
      if (condition.comparator === '>=' && now >= condition.value) {
        return true;
      }
      if (condition.comparator === '<=' && now <= condition.value) {
        return true;
      }
    }
  }

  // For other conditions, we'd need to check on-chain
  // Return false by default - caller should attempt decrypt
  return false;
}

/**
 * Parse decrypted JSON data
 */
export async function decryptJSON<T>(
  payload: EncryptedPayload,
  authSig?: AuthSignature
): Promise<T> {
  const kms = getKMS();
  await kms.initialize();

  const decrypted = await kms.decrypt({
    payload,
    authSig,
  });

  return JSON.parse(decrypted) as T;
}

/**
 * Decrypt and verify data integrity
 */
export async function decryptAndVerify(
  payload: EncryptedPayload,
  authSig: AuthSignature,
  expectedHash?: Hex
): Promise<{ data: string; verified: boolean }> {
  const kms = getKMS();
  await kms.initialize();

  const decrypted = await kms.decrypt({
    payload,
    authSig,
  });

  // If expected hash provided, verify
  if (expectedHash) {
    const { keccak256, toBytes } = await import('viem');
    const actualHash = keccak256(toBytes(decrypted));
    return {
      data: decrypted,
      verified: actualHash === expectedHash,
    };
  }

  return {
    data: decrypted,
    verified: true, // No hash to verify against
  };
}

