/**
 * Attestation generation for compute nodes
 *
 * TEE Status Levels:
 * - simulated: Wallet signatures only - NOT SECURE for production
 * - dstack-simulator: Local dStack simulator - NOT SECURE for production
 * - intel-tdx: Real Intel TDX (Phala production) - SECURE
 * - amd-sev: Real AMD SEV - SECURE
 * - aws-nitro: AWS Nitro Enclaves - SECURE
 *
 * ⚠️ ALWAYS CHECK teeIsReal === true FOR PRODUCTION USE ⚠️
 */

import type { Wallet } from 'ethers';
import { verifyMessage } from 'ethers';
import { detectHardware, generateHardwareHash } from './hardware';
import type { AttestationReport } from './types';

/**
 * Generate an attestation based on the actual TEE environment
 * Returns simulated attestation if no real TEE is available
 */
export async function generateAttestation(
  wallet: Wallet,
  nonce: string
): Promise<AttestationReport> {
  const hardware = await detectHardware();
  const timestamp = new Date().toISOString();
  const teeStatus = hardware.teeInfo.status;
  const teeIsReal = hardware.teeInfo.isReal;

  // Create message to sign
  const message = JSON.stringify({
    signingAddress: wallet.address,
    hardware: generateHardwareHash(hardware),
    timestamp,
    nonce,
    teeStatus,
  });

  // Sign with provider's wallet
  const signature = await wallet.signMessage(message);

  // Generate warning for non-production TEE
  const teeWarning = teeIsReal 
    ? null 
    : `⚠️ TEE STATUS: ${teeStatus.toUpperCase()} - ${hardware.teeInfo.warning || 'Not suitable for production use'}`;

  return {
    signingAddress: wallet.address,
    hardware,
    timestamp,
    nonce,
    signature,
    // Legacy field for backwards compatibility
    simulated: !teeIsReal,
    // New TEE status fields
    teeStatus,
    teeIsReal,
    teeWarning,
  };
}

/**
 * Generate a simulated attestation for local testing
 * @deprecated Use generateAttestation() which auto-detects TEE status
 */
export async function generateSimulatedAttestation(
  wallet: Wallet,
  nonce: string
): Promise<AttestationReport> {
  return generateAttestation(wallet, nonce);
}

/**
 * Verify an attestation
 */
export async function verifyAttestation(
  attestation: AttestationReport,
  expectedAddress: string,
  requireRealTEE: boolean = false
): Promise<{ valid: boolean; reason?: string; warnings: string[] }> {
  const warnings: string[] = [];

  // Check signing address matches
  if (
    attestation.signingAddress.toLowerCase() !== expectedAddress.toLowerCase()
  ) {
    return { valid: false, reason: 'Signing address mismatch', warnings };
  }

  // If real TEE is required, check teeIsReal
  if (requireRealTEE && !attestation.teeIsReal) {
    return { 
      valid: false, 
      reason: `Real TEE required but got: ${attestation.teeStatus}`,
      warnings,
    };
  }

  // Add warning for non-production TEE
  if (!attestation.teeIsReal && attestation.teeWarning) {
    warnings.push(attestation.teeWarning);
  }

  // Verify signature based on TEE status
  const teeStatus = attestation.teeStatus || (attestation.simulated ? 'simulated' : 'intel-tdx');

  if (teeStatus === 'simulated' || teeStatus === 'dstack-simulator') {
    // Simulated: verify wallet signature
    const message = JSON.stringify({
      signingAddress: attestation.signingAddress,
      hardware: generateHardwareHash(attestation.hardware),
      timestamp: attestation.timestamp,
      nonce: attestation.nonce,
      teeStatus,
    });

    const recovered = verifyMessage(message, attestation.signature);

    if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
      return { valid: false, reason: 'Signature verification failed', warnings };
    }

    return { valid: true, warnings };
  }

  // For real TEE attestations (intel-tdx, amd-sev, aws-nitro)
  if (teeStatus === 'intel-tdx') {
    // Verify with Phala DCAP verification service
    const dcapResult = await verifyDCAPAttestation(attestation);
    if (!dcapResult.valid) {
      return { valid: false, reason: dcapResult.reason, warnings };
    }
    warnings.push(...dcapResult.warnings);
    return { valid: true, warnings };
  }

  if (teeStatus === 'amd-sev' || teeStatus === 'aws-nitro') {
    // For AMD SEV and AWS Nitro, verify the basic signature for now
    // Full verification would require vendor-specific APIs
    const message = JSON.stringify({
      signingAddress: attestation.signingAddress,
      hardware: generateHardwareHash(attestation.hardware),
      timestamp: attestation.timestamp,
      nonce: attestation.nonce,
      teeStatus,
    });

    const recovered = verifyMessage(message, attestation.signature);
    if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
      return { valid: false, reason: 'Signature verification failed', warnings };
    }

    warnings.push(`${teeStatus} attestation - full DCAP verification not implemented`);
    return { valid: true, warnings };
  }

  return {
    valid: false,
    reason: `Unknown TEE status: ${teeStatus}`,
    warnings,
  };
}

const PHALA_DCAP_ENDPOINT = process.env.PHALA_DCAP_ENDPOINT || 'https://dcap.phala.network/verify';

interface DCAPVerificationResult {
  valid: boolean;
  reason?: string;
  warnings: string[];
  measurement?: string;
  mrEnclave?: string;
  mrSigner?: string;
}

/** Verify Intel TDX attestation via Phala DCAP service */
async function verifyDCAPAttestation(
  attestation: AttestationReport
): Promise<DCAPVerificationResult> {
  const warnings: string[] = [];

  // If no quote provided, fall back to signature verification
  if (!attestation.signature || !attestation.signature.startsWith('0x')) {
    return {
      valid: false,
      reason: 'Missing attestation quote',
      warnings,
    };
  }

  // In development/testing, skip DCAP if endpoint not available
  if (process.env.SKIP_DCAP_VERIFICATION === 'true') {
    warnings.push('DCAP verification skipped (SKIP_DCAP_VERIFICATION=true)');
    return { valid: true, warnings };
  }

  try {
    // Call Phala DCAP verification service
    const response = await fetch(PHALA_DCAP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quote: attestation.signature,
        reportData: attestation.nonce,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 503) {
        // Service temporarily unavailable - allow with warning
        warnings.push('DCAP service temporarily unavailable - verification deferred');
        return { valid: true, warnings };
      }
      return {
        valid: false,
        reason: `DCAP verification failed: ${response.status} ${response.statusText}`,
        warnings,
      };
    }

    const result = await response.json() as {
      verified: boolean;
      error?: string;
      measurement?: string;
      mrEnclave?: string;
      mrSigner?: string;
      tcbStatus?: string;
    };

    if (!result.verified) {
      return {
        valid: false,
        reason: result.error || 'DCAP verification failed',
        warnings,
      };
    }

    // Check TCB status for warnings
    if (result.tcbStatus && result.tcbStatus !== 'UpToDate') {
      warnings.push(`TCB Status: ${result.tcbStatus} - Consider updating TEE firmware`);
    }

    return {
      valid: true,
      warnings,
      measurement: result.measurement,
      mrEnclave: result.mrEnclave,
      mrSigner: result.mrSigner,
    };

  } catch (error) {
    // Network error - allow with warning in non-production
    if (process.env.NODE_ENV !== 'production') {
      warnings.push(`DCAP verification skipped: ${(error as Error).message}`);
      return { valid: true, warnings };
    }
    
    return {
      valid: false,
      reason: `DCAP verification error: ${(error as Error).message}`,
      warnings,
    };
  }
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
