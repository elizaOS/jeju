/**
 * Commit-Reveal Protocol
 *
 * Implements a commit-reveal scheme for game state updates:
 *
 * 1. COMMIT: TEE publishes hash(encrypted_state) to storage/chain
 * 2. WAIT: Mandatory delay (e.g., 1 block or N seconds)
 * 3. REVEAL: TEE publishes actual encrypted state
 * 4. VERIFY: Anyone can verify reveal matches commit
 *
 * This prevents:
 * - Front-running (attackers can't see state before commit)
 * - Timing attacks (delay ensures commitment is final)
 * - Data manipulation (reveal must match commit)
 */

import type { Hex } from 'viem';
import { keccak256 } from 'viem';
import type { Storage } from '../storage/storage-interface.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Commitment {
  /** Unique commitment ID */
  id: string;
  /** Hash of the data to be revealed */
  dataHash: Hex;
  /** Timestamp of commitment */
  commitTimestamp: number;
  /** Minimum reveal time (commitTimestamp + revealDelay) */
  revealAfter: number;
  /** Storage ID of commitment record */
  storageId: string;
  /** Type of data being committed */
  dataType: 'game-state' | 'training-data' | 'model-update';
  /** Nonce to prevent replay */
  nonce: number;
}

export interface Reveal {
  /** Commitment ID this reveal corresponds to */
  commitmentId: string;
  /** The actual data (encrypted for game state) */
  data: Uint8Array;
  /** Hash of the data (must match commitment) */
  dataHash: Hex;
  /** Timestamp of reveal */
  revealTimestamp: number;
  /** Storage ID of revealed data */
  storageId: string;
}

export interface CommitRevealConfig {
  /** Minimum delay between commit and reveal (ms) */
  revealDelay: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMIT-REVEAL MANAGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manages the commit-reveal protocol for secure data updates
 */
export class CommitRevealManager {
  private storage: Storage;
  private config: CommitRevealConfig;
  private commitments: Map<string, Commitment> = new Map();
  private reveals: Map<string, Reveal> = new Map();
  private nonce = 0;

  constructor(storage: Storage, config: CommitRevealConfig) {
    this.storage = storage;
    this.config = config;
  }

  /**
   * Phase 1: Create a commitment to data without revealing it
   */
  async commit(
    data: Uint8Array,
    dataType: Commitment['dataType']
  ): Promise<Commitment> {
    // Hash the data
    const hexData = `0x${Buffer.from(data).toString('hex')}` as const;
    const dataHash = keccak256(hexData);

    const now = Date.now();
    const commitmentId = `commit-${now}-${++this.nonce}`;

    // Create commitment record (public, can be verified by anyone)
    const commitmentRecord = {
      id: commitmentId,
      dataHash,
      commitTimestamp: now,
      revealAfter: now + this.config.revealDelay,
      dataType,
      nonce: this.nonce,
      // Signature could be added here for on-chain verification
    };

    // Upload commitment to storage
    const result = await this.storage.uploadJSON(commitmentRecord, {
      encrypted: false, // Commitments are PUBLIC
      tags: {
        'Data-Type': 'commitment',
        'Commitment-ID': commitmentId,
        'Reveal-After': commitmentRecord.revealAfter.toString(),
      },
    });

    const commitment: Commitment = {
      ...commitmentRecord,
      storageId: result.id,
    };

    this.commitments.set(commitmentId, commitment);

    if (this.config.verbose) {
      console.log(`[CommitReveal] 📝 Committed: ${commitmentId}`);
      console.log(`  Hash: ${dataHash.slice(0, 20)}...`);
      console.log(
        `  Reveal after: ${new Date(commitment.revealAfter).toISOString()}`
      );
    }

    return commitment;
  }

  /**
   * Phase 2: Reveal the data (must be after revealAfter time)
   */
  async reveal(commitmentId: string, data: Uint8Array): Promise<Reveal> {
    const commitment = this.commitments.get(commitmentId);
    if (!commitment) {
      throw new Error(`Unknown commitment: ${commitmentId}`);
    }

    const now = Date.now();

    // Verify timing
    if (now < commitment.revealAfter) {
      const waitMs = commitment.revealAfter - now;
      throw new Error(
        `Cannot reveal yet. Wait ${waitMs}ms (until ${new Date(commitment.revealAfter).toISOString()})`
      );
    }

    // Verify data matches commitment
    const hexData = `0x${Buffer.from(data).toString('hex')}` as const;
    const dataHash = keccak256(hexData);

    if (dataHash !== commitment.dataHash) {
      throw new Error(
        `Data hash mismatch! Expected: ${commitment.dataHash}, got: ${dataHash}`
      );
    }

    // Upload revealed data
    const result = await this.storage.upload(data, {
      encrypted: commitment.dataType === 'game-state', // Game state is encrypted
      tags: {
        'Data-Type': 'reveal',
        'Commitment-ID': commitmentId,
        'Data-Hash': dataHash,
      },
    });

    const reveal: Reveal = {
      commitmentId,
      data,
      dataHash,
      revealTimestamp: now,
      storageId: result.id,
    };

    this.reveals.set(commitmentId, reveal);

    if (this.config.verbose) {
      console.log(`[CommitReveal] ✅ Revealed: ${commitmentId}`);
      console.log(`  Storage ID: ${result.id}`);
      console.log(`  Size: ${data.length} bytes`);
    }

    return reveal;
  }

  /**
   * Verify that a reveal matches its commitment
   */
  async verifyReveal(
    commitmentId: string,
    revealedData: Uint8Array
  ): Promise<{ valid: boolean; error?: string }> {
    const commitment = this.commitments.get(commitmentId);
    if (!commitment) {
      return { valid: false, error: 'Unknown commitment' };
    }

    // Compute hash of revealed data
    const hexData = `0x${Buffer.from(revealedData).toString('hex')}` as const;
    const computedHash = keccak256(hexData);

    if (computedHash !== commitment.dataHash) {
      return {
        valid: false,
        error: `Hash mismatch: expected ${commitment.dataHash}, got ${computedHash}`,
      };
    }

    return { valid: true };
  }

  /**
   * Get a commitment by ID
   */
  getCommitment(id: string): Commitment | undefined {
    return this.commitments.get(id);
  }

  /**
   * Get a reveal by commitment ID
   */
  getReveal(commitmentId: string): Reveal | undefined {
    return this.reveals.get(commitmentId);
  }

  /**
   * Get all pending commitments (not yet revealed)
   */
  getPendingCommitments(): Commitment[] {
    const pending: Commitment[] = [];
    for (const [id, commitment] of this.commitments) {
      if (!this.reveals.has(id)) {
        pending.push(commitment);
      }
    }
    return pending;
  }

  /**
   * Check if a commitment can be revealed now
   */
  canReveal(commitmentId: string): boolean {
    const commitment = this.commitments.get(commitmentId);
    if (!commitment) return false;
    return Date.now() >= commitment.revealAfter;
  }

  /**
   * Wait until a commitment can be revealed
   */
  async waitForReveal(commitmentId: string): Promise<void> {
    const commitment = this.commitments.get(commitmentId);
    if (!commitment) {
      throw new Error(`Unknown commitment: ${commitmentId}`);
    }

    const waitMs = commitment.revealAfter - Date.now();
    if (waitMs > 0) {
      if (this.config.verbose) {
        console.log(
          `[CommitReveal] ⏳ Waiting ${waitMs}ms for reveal window...`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute hash of data for commitment
 */
export function computeDataHash(data: Uint8Array): Hex {
  const hexData = `0x${Buffer.from(data).toString('hex')}` as const;
  return keccak256(hexData);
}

/**
 * Verify data matches a hash
 */
export function verifyDataHash(data: Uint8Array, expectedHash: Hex): boolean {
  return computeDataHash(data) === expectedHash;
}
