/**
 * KMS SDK - Signing Utilities
 *
 * High-level functions for threshold and TEE-based signing.
 */

import type { Address, Hex } from 'viem';
import { getKMS } from '../kms.js';
import type {
  AccessControlPolicy,
  GeneratedKey,
  KeyCurve,
  SignedMessage,
  ThresholdSignature,
} from '../types.js';

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a signing key
 */
export async function generateSigningKey(
  owner: Address,
  policy: AccessControlPolicy,
  curve: KeyCurve = 'secp256k1'
): Promise<GeneratedKey> {
  const kms = getKMS();
  await kms.initialize();

  return kms.generateKey(owner, {
    type: 'signing' as const,
    curve,
    policy,
  });
}

/**
 * Generate an encryption key
 */
export async function generateEncryptionKey(
  owner: Address,
  policy: AccessControlPolicy
): Promise<GeneratedKey> {
  const kms = getKMS();
  await kms.initialize();

  return kms.generateKey(owner, {
    type: 'encryption' as const,
    curve: 'secp256k1' as const,
    policy,
  });
}

// ============================================================================
// Signing Functions
// ============================================================================

/**
 * Sign a message with a KMS key
 */
export async function sign(
  message: string | Uint8Array,
  keyId: string,
  hashAlgorithm: 'keccak256' | 'sha256' | 'none' = 'keccak256'
): Promise<SignedMessage> {
  const kms = getKMS();
  await kms.initialize();

  return kms.sign({
    message,
    keyId,
    hashAlgorithm,
  });
}

/**
 * Sign with Ethereum-style personal sign prefix
 */
export async function personalSign(
  message: string,
  keyId: string
): Promise<SignedMessage> {
  const prefix = '\x19Ethereum Signed Message:\n';
  const prefixedMessage = `${prefix}${message.length}${message}`;

  const kms = getKMS();
  await kms.initialize();

  return kms.sign({
    message: prefixedMessage,
    keyId,
    hashAlgorithm: 'keccak256',
  });
}

/**
 * Sign EIP-712 typed data
 */
export async function signTypedData(
  domainSeparator: Hex,
  structHash: Hex,
  keyId: string
): Promise<SignedMessage> {
  // EIP-712 encoding: \x19\x01 ++ domainSeparator ++ structHash
  const { concat, toBytes } = await import('viem');
  const prefix = toBytes('0x1901');
  const message = concat([prefix, toBytes(domainSeparator), toBytes(structHash)]);

  const kms = getKMS();
  await kms.initialize();

  return kms.sign({
    message,
    keyId,
    hashAlgorithm: 'keccak256',
  });
}

// ============================================================================
// Threshold Signing
// ============================================================================

/**
 * Sign with threshold (MPC)
 */
export async function thresholdSign(
  message: string | Uint8Array,
  keyId: string,
  threshold: number,
  totalParties: number
): Promise<ThresholdSignature> {
  const kms = getKMS();
  await kms.initialize();

  return kms.thresholdSign({
    message,
    keyId,
    threshold,
    totalParties,
    hashAlgorithm: 'keccak256',
  });
}

/**
 * Sign a transaction hash with threshold
 */
export async function thresholdSignTransaction(
  txHash: Hex,
  keyId: string,
  threshold: number,
  totalParties: number
): Promise<ThresholdSignature> {
  const { toBytes } = await import('viem');

  const kms = getKMS();
  await kms.initialize();

  // Already hashed, use keccak256 to pass through (message will be re-hashed but that's expected)
  return kms.thresholdSign({
    message: toBytes(txHash),
    keyId,
    threshold,
    totalParties,
    hashAlgorithm: 'keccak256',
  });
}

// ============================================================================
// Key Management
// ============================================================================

/**
 * Get key metadata
 */
export function getKey(keyId: string) {
  const kms = getKMS();
  return kms.getKey(keyId);
}

/**
 * Revoke a key
 */
export async function revokeKey(keyId: string): Promise<void> {
  const kms = getKMS();
  await kms.initialize();
  return kms.revokeKey(keyId);
}

