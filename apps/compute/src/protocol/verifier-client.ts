/**
 * Verifier Client
 *
 * A client that can run locally and:
 * 1. Watch for new commits/reveals on the network
 * 2. Verify data integrity without decryption
 * 3. Verify the commit-reveal protocol is followed
 * 4. Demonstrate that public clients can interact with the permissionless network
 *
 * This proves:
 * - Data is publicly accessible (permissionless)
 * - Data integrity can be verified by anyone
 * - The protocol is transparent and auditable
 */

import type { Storage } from '../storage/storage-interface.js';
import type { SealedData } from '../tee/keystore.js';
import type { Commitment, Reveal } from './commit-reveal.js';
import { verifyDataHash } from './commit-reveal.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface VerificationReport {
  timestamp: number;
  commitmentId: string;
  checks: VerificationCheck[];
  allPassed: boolean;
  securityScore: number; // 0-100
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface DataIntegrityResult {
  valid: boolean;
  checks: {
    hashMatches: boolean;
    notPlaintext: boolean;
    hasValidStructure: boolean;
    timestampValid: boolean;
  };
  details: string;
}

export interface NetworkState {
  commitments: Commitment[];
  reveals: Reveal[];
  lastUpdated: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFIER CLIENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Client that verifies the permissionless network state
 */
export class VerifierClient {
  private storage: Storage;
  private knownCommitments: Map<string, Commitment> = new Map();
  private knownReveals: Map<string, Reveal> = new Map();
  private verbose: boolean;

  constructor(storage: Storage, verbose = false) {
    this.storage = storage;
    this.verbose = verbose;
  }

  /**
   * Fetch and verify a commitment from storage
   */
  async fetchCommitment(storageId: string): Promise<Commitment> {
    const data = await this.storage.downloadJSON<Commitment>(storageId);

    // Verify commitment structure
    if (!data.id || !data.dataHash || !data.commitTimestamp) {
      throw new Error('Invalid commitment structure');
    }

    this.knownCommitments.set(data.id, data);

    if (this.verbose) {
      console.log(`[VerifierClient] 📥 Fetched commitment: ${data.id}`);
    }

    return data;
  }

  /**
   * Fetch and verify a reveal from storage
   */
  async fetchReveal(
    storageId: string,
    commitmentId: string
  ): Promise<{
    reveal: Reveal;
    verification: DataIntegrityResult;
  }> {
    const data = await this.storage.download(storageId);
    const commitment = this.knownCommitments.get(commitmentId);

    if (!commitment) {
      throw new Error(`Unknown commitment: ${commitmentId}`);
    }

    // Verify data matches commitment hash
    const hashMatches = verifyDataHash(data, commitment.dataHash);

    // Check if data looks like encrypted content (not plaintext)
    const dataStr = new TextDecoder().decode(data);
    let parsedData: SealedData | null = null;
    let hasValidStructure = false;
    let notPlaintext = true;

    try {
      parsedData = JSON.parse(dataStr) as SealedData;
      // Check for encrypted structure
      hasValidStructure = !!(
        parsedData.payload?.ciphertext &&
        parsedData.payload?.iv &&
        parsedData.payload?.alg === 'AES-256-GCM'
      );
      // If it parses as JSON with plaintext fields, it's suspicious
      notPlaintext = hasValidStructure;
    } catch {
      // Not JSON - could be raw encrypted bytes, which is OK
      notPlaintext = true;
      hasValidStructure = false;
    }

    const reveal: Reveal = {
      commitmentId,
      data,
      dataHash: commitment.dataHash,
      revealTimestamp: Date.now(),
      storageId,
    };

    this.knownReveals.set(commitmentId, reveal);

    const verification: DataIntegrityResult = {
      valid: hashMatches && notPlaintext,
      checks: {
        hashMatches,
        notPlaintext,
        hasValidStructure,
        timestampValid: Date.now() >= commitment.revealAfter,
      },
      details: hashMatches
        ? 'Data integrity verified'
        : 'Data hash does not match commitment!',
    };

    if (this.verbose) {
      console.log(`[VerifierClient] 📥 Fetched reveal for: ${commitmentId}`);
      console.log(`  Hash matches: ${hashMatches ? '✓' : '✗'}`);
      console.log(`  Not plaintext: ${notPlaintext ? '✓' : '✗'}`);
      console.log(`  Valid structure: ${hasValidStructure ? '✓' : '✗'}`);
    }

    return { reveal, verification };
  }

  /**
   * Verify encrypted data doesn't contain plaintext secrets
   */
  verifyNoPlaintextLeaks(
    encryptedData: Uint8Array,
    knownSecrets: string[]
  ): { safe: boolean; leakedSecrets: string[] } {
    const dataStr = new TextDecoder().decode(encryptedData);
    const leakedSecrets: string[] = [];

    for (const secret of knownSecrets) {
      if (dataStr.includes(secret)) {
        leakedSecrets.push(secret);
      }
    }

    return {
      safe: leakedSecrets.length === 0,
      leakedSecrets,
    };
  }

  /**
   * Generate a full verification report for a commit-reveal pair
   */
  async generateReport(
    commitment: Commitment,
    revealStorageId: string
  ): Promise<VerificationReport> {
    const checks: VerificationCheck[] = [];

    // 1. Verify commitment exists and is valid
    checks.push({
      name: 'Commitment Valid',
      passed: !!commitment.dataHash && !!commitment.id,
      details: commitment.id ? `ID: ${commitment.id}` : 'Missing commitment ID',
      severity: 'critical',
    });

    // 2. Verify timing (reveal happened after revealAfter)
    const now = Date.now();
    checks.push({
      name: 'Timing Valid',
      passed: now >= commitment.revealAfter,
      details:
        now >= commitment.revealAfter
          ? `Revealed at ${new Date(now).toISOString()}`
          : `Revealed too early! Should wait until ${new Date(commitment.revealAfter).toISOString()}`,
      severity: 'critical',
    });

    // 3. Fetch and verify reveal
    const revealData = await this.storage.download(revealStorageId);
    const hashMatches = verifyDataHash(revealData, commitment.dataHash);

    if (revealData) {
      // 4. Verify hash matches
      checks.push({
        name: 'Hash Integrity',
        passed: hashMatches,
        details: hashMatches
          ? `Hash verified: ${commitment.dataHash.slice(0, 20)}...`
          : 'Hash mismatch - data was tampered!',
        severity: 'critical',
      });

      // 5. Verify data is encrypted (not plaintext)
      const dataStr = new TextDecoder().decode(revealData);
      let isEncrypted = false;

      const parsed = JSON.parse(dataStr) as SealedData;
      isEncrypted = !!(
        parsed.payload?.ciphertext &&
        parsed.payload?.iv &&
        parsed.payload?.alg === 'AES-256-GCM'
      );

      checks.push({
        name: 'Data Encrypted',
        passed: isEncrypted,
        details: isEncrypted
          ? 'Data appears to be encrypted'
          : 'WARNING: Data may be plaintext!',
        severity: 'warning',
      });

      // 6. Check for obvious plaintext leaks
      const suspiciousPatterns = [
        'password',
        'secret',
        'private_key',
        'api_key',
      ];
      const hasLeaks = suspiciousPatterns.some((p) =>
        dataStr.toLowerCase().includes(p)
      );

      checks.push({
        name: 'No Plaintext Leaks',
        passed: !hasLeaks,
        details: hasLeaks
          ? 'WARNING: Suspicious plaintext detected!'
          : 'No obvious plaintext secrets found',
        severity: hasLeaks ? 'critical' : 'info',
      });
    }

    // Calculate security score
    const criticalChecks = checks.filter((c) => c.severity === 'critical');
    const criticalPassed = criticalChecks.filter((c) => c.passed).length;
    const securityScore = Math.round(
      (criticalPassed / criticalChecks.length) * 100
    );

    return {
      timestamp: Date.now(),
      commitmentId: commitment.id,
      checks,
      allPassed: checks.every((c) => c.passed),
      securityScore,
    };
  }

  /**
   * Format a verification report for display
   */
  formatReport(report: VerificationReport): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(
      '╔═══════════════════════════════════════════════════════════════════╗'
    );
    lines.push(
      '║                   VERIFICATION REPORT                             ║'
    );
    lines.push(
      '╠═══════════════════════════════════════════════════════════════════╣'
    );
    lines.push(
      `║ Commitment: ${report.commitmentId.slice(0, 40).padEnd(40)}       ║`
    );
    lines.push(
      `║ Timestamp:  ${new Date(report.timestamp).toISOString().padEnd(40)}       ║`
    );
    lines.push(`║ Score:      ${report.securityScore}%${' '.repeat(46)}║`);
    lines.push(
      '╠═══════════════════════════════════════════════════════════════════╣'
    );

    for (const check of report.checks) {
      const icon = check.passed
        ? '✅'
        : check.severity === 'critical'
          ? '❌'
          : '⚠️';
      lines.push(
        `║ ${icon} ${check.name.padEnd(20)} ${check.passed ? 'PASS' : 'FAIL'}                          ║`
      );
      lines.push(`║    ${check.details.slice(0, 55).padEnd(55)}     ║`);
    }

    lines.push(
      '╠═══════════════════════════════════════════════════════════════════╣'
    );
    lines.push(
      `║ RESULT: ${report.allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}                                  ║`
    );
    lines.push(
      '╚═══════════════════════════════════════════════════════════════════╝'
    );

    return lines.join('\n');
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState {
    return {
      commitments: Array.from(this.knownCommitments.values()),
      reveals: Array.from(this.knownReveals.values()),
      lastUpdated: Date.now(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY AUDIT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Perform a security audit on encrypted data
 */
export function auditEncryptedData(
  data: Uint8Array,
  knownSecrets: string[] = []
): {
  safe: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const dataStr = new TextDecoder().decode(data);

  // Check for plaintext secrets
  for (const secret of knownSecrets) {
    if (dataStr.includes(secret)) {
      issues.push(
        `CRITICAL: Secret "${secret.slice(0, 10)}..." found in plaintext!`
      );
    }
  }

  // Check for common sensitive patterns
  const sensitivePatterns = [
    { pattern: /password['":\s]*['"][^'"]+['"]/, name: 'password' },
    { pattern: /api_?key['":\s]*['"][^'"]+['"]/, name: 'API key' },
    { pattern: /private_?key['":\s]*['"][^'"]+['"]/, name: 'private key' },
    { pattern: /0x[a-fA-F0-9]{64}/, name: 'hex key (64 chars)' },
  ];

  for (const { pattern, name } of sensitivePatterns) {
    if (pattern.test(dataStr)) {
      issues.push(`WARNING: Possible ${name} in plaintext`);
    }
  }

  // Check for proper encryption structure
  try {
    const parsed = JSON.parse(dataStr) as SealedData;
    if (!parsed.payload?.ciphertext) {
      issues.push('Data does not have encrypted payload structure');
    }
    if (parsed.payload?.alg !== 'AES-256-GCM') {
      recommendations.push('Consider using AES-256-GCM for encryption');
    }
    if (!parsed.payload?.iv) {
      issues.push('CRITICAL: Missing IV in encrypted payload');
    }
  } catch {
    // Not JSON - might be raw binary which is OK
    recommendations.push('Data is not in standard sealed JSON format');
  }

  // Check entropy
  const entropy = calculateEntropy(data);
  if (entropy < 5.5) {
    issues.push(
      `Low entropy (${entropy.toFixed(2)} bits/byte) - may not be encrypted`
    );
  }

  return {
    safe: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * Calculate Shannon entropy of data
 */
function calculateEntropy(data: Uint8Array): number {
  if (data.length === 0) return 0;

  const freq = new Array(256).fill(0);
  for (const byte of data) {
    freq[byte]++;
  }

  let entropy = 0;
  const len = data.length;
  for (const count of freq) {
    if (count > 0) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}
