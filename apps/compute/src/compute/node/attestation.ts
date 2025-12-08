/**
 * Attestation generation for compute nodes
 *
 * ⚠️  SIMULATED ATTESTATION WARNING ⚠️
 * Currently, all attestations are SIMULATED (wallet signatures only).
 * This provides NO cryptographic guarantee of hardware/TEE.
 *
 * For real attestation, integrate with:
 * - Phala dstack for Intel TDX CPU attestation
 * - NVIDIA NRAS for GPU attestation
 *
 * All simulated attestations have `simulated: true` flag.
 * Production systems MUST verify `simulated === false`.
 */

import type { Wallet } from 'ethers';
import { verifyMessage } from 'ethers';
import { detectHardware, generateHardwareHash } from './hardware';
import type { AttestationReport } from './types';

/**
 * Generate a simulated attestation for local testing
 */
export async function generateSimulatedAttestation(
  wallet: Wallet,
  nonce: string
): Promise<AttestationReport> {
  const hardware = await detectHardware();
  const timestamp = new Date().toISOString();

  // Create message to sign
  const message = JSON.stringify({
    signingAddress: wallet.address,
    hardware: generateHardwareHash(hardware),
    timestamp,
    nonce,
    simulated: true,
  });

  // Sign with provider's wallet
  const signature = await wallet.signMessage(message);

  return {
    signingAddress: wallet.address,
    hardware,
    timestamp,
    nonce,
    signature,
    simulated: true,
  };
}

/**
 * Verify an attestation
 */
export function verifyAttestation(
  attestation: AttestationReport,
  expectedAddress: string
): { valid: boolean; reason?: string } {
  // Check signing address matches
  if (
    attestation.signingAddress.toLowerCase() !== expectedAddress.toLowerCase()
  ) {
    return { valid: false, reason: 'Signing address mismatch' };
  }

  // For simulated attestations, verify the signature
  if (attestation.simulated) {
    const message = JSON.stringify({
      signingAddress: attestation.signingAddress,
      hardware: generateHardwareHash(attestation.hardware),
      timestamp: attestation.timestamp,
      nonce: attestation.nonce,
      simulated: true,
    });

    const recovered = verifyMessage(message, attestation.signature);

    if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
      return { valid: false, reason: 'Signature verification failed' };
    }

    return { valid: true };
  }

  // For real attestations, we would verify with NVIDIA NRAS and Intel TDX
  // This is a placeholder for when we integrate with Phala
  return {
    valid: false,
    reason: 'Real attestation verification not implemented',
  };
}

/**
 * Check if attestation is fresh (within time window)
 */
export function isAttestationFresh(
  attestation: AttestationReport,
  maxAgeMs: number = 3600000 // 1 hour default
): boolean {
  const attestationTime = new Date(attestation.timestamp).getTime();
  const now = Date.now();
  return now - attestationTime < maxAgeMs;
}

/**
 * Generate attestation hash for on-chain storage
 */
export function getAttestationHash(attestation: AttestationReport): string {
  const data = JSON.stringify({
    signingAddress: attestation.signingAddress,
    hardwareHash: generateHardwareHash(attestation.hardware),
    timestamp: attestation.timestamp,
  });

  const hash = Bun.hash(data);
  return `0x${hash.toString(16).padStart(64, '0')}`;
}
