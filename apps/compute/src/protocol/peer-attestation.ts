/**
 * Peer Attestation Protocol (PBTS-aligned)
 *
 * Based on Phala's Persistent BitTorrent Tracker System (PBTS) paper:
 * https://eprint.iacr.org/2025/2131.pdf
 *
 * Key insight from the paper:
 * > "Receiving peers sign receipts for transferred pieces, which
 * > the tracker aggregates and verifies before updating on-chain reputation."
 *
 * This replaces self-reported statistics with cryptographic attestations:
 * - Attest: Receiver signs proof that they received data from sender
 * - Verify: Anyone can verify the receipt is valid
 * - Aggregate: Multiple receipts can be batched for efficient on-chain updates
 *
 * Unlike commit-reveal (which prevents front-running), peer attestation
 * proves actual data transfer occurred between two parties.
 */

import type { Address, Hex } from 'viem';
import { keccak256, toBytes, verifyMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (Following PBTS paper Definition 4.1)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transfer receipt - cryptographic proof of data transfer
 * Following PBTS: "Attest generates cryptographic receipt binding
 * infohash, sender's public key, piece hash, piece index, and epoch"
 */
export interface TransferReceipt {
  /** Unique receipt ID */
  id: string;
  /** Sender's address (who uploaded) */
  sender: Address;
  /** Receiver's address (who downloaded and signed) */
  receiver: Address;
  /** Hash of the content transferred */
  contentHash: Hex;
  /** Size of data transferred in bytes */
  size: number;
  /** Epoch timestamp (for double-spend prevention) */
  epoch: number;
  /** Receiver's signature over the receipt data */
  signature: Hex;
  /** Timestamp when receipt was created */
  timestamp: number;
}

/**
 * Aggregated receipts for batch on-chain updates
 * Following PBTS: "The tracker aggregates attestations, creating
 * an auditable chain of custody for reported statistics."
 */
export interface AggregatedReceipts {
  /** Sender address */
  sender: Address;
  /** All receipt IDs included */
  receiptIds: string[];
  /** Total bytes uploaded */
  totalUploaded: number;
  /** Aggregated hash of all receipts */
  aggregateHash: Hex;
  /** Epoch range covered */
  epochRange: { start: number; end: number };
  /** Individual receipts for verification */
  receipts: TransferReceipt[];
}

/**
 * Receipt verification result
 */
export interface ReceiptVerification {
  valid: boolean;
  errors: string[];
  details: {
    signatureValid: boolean;
    epochValid: boolean;
    hashValid: boolean;
    senderMatches: boolean;
    receiverMatches: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EPOCH MANAGEMENT (PBTS Section 4.2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Epoch width in milliseconds (e.g., 1 hour)
 * Following PBTS: "Time is divided into discrete epochs"
 */
const EPOCH_WIDTH_MS = 60 * 60 * 1000; // 1 hour

/**
 * Maximum age of receipts in epochs
 * Following PBTS: "accepting only receipts with recent timestamps"
 */
const MAX_RECEIPT_AGE_EPOCHS = 24; // 24 hours

/**
 * Get current epoch number
 */
export function getCurrentEpoch(): number {
  return Math.floor(Date.now() / EPOCH_WIDTH_MS);
}

/**
 * Check if an epoch is within valid range
 */
export function isEpochValid(epoch: number): boolean {
  const currentEpoch = getCurrentEpoch();
  return (
    epoch >= currentEpoch - MAX_RECEIPT_AGE_EPOCHS && epoch <= currentEpoch
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTESTATION FUNCTIONS (PBTS Definition 4.1)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a transfer receipt (receiver attests they received data)
 *
 * Following PBTS Attest algorithm:
 * "Generates cryptographic receipt for piece transfer, where receiving
 * peer signs acknowledgment for sending peer."
 */
export async function createReceipt(
  receiverPrivateKey: Hex,
  senderAddress: Address,
  contentHash: Hex,
  size: number
): Promise<TransferReceipt> {
  const receiverAccount = privateKeyToAccount(receiverPrivateKey);
  const epoch = getCurrentEpoch();
  const timestamp = Date.now();
  const receiptId = `receipt-${epoch}-${timestamp}-${contentHash.slice(0, 10)}`;

  // Construct message to sign (matches PBTS format)
  // m ← (contentHash ∥ sender ∥ size ∥ epoch)
  const message = constructReceiptMessage(
    contentHash,
    senderAddress,
    receiverAccount.address,
    size,
    epoch
  );

  // Sign with receiver's key
  const signature = await receiverAccount.signMessage({ message });

  return {
    id: receiptId,
    sender: senderAddress,
    receiver: receiverAccount.address,
    contentHash,
    size,
    epoch,
    signature,
    timestamp,
  };
}

/**
 * Verify a transfer receipt
 *
 * Following PBTS Verify algorithm:
 * "Verifies cryptographic receipt by checking receiver's signature"
 */
export async function verifyReceipt(
  receipt: TransferReceipt,
  expectedSender?: Address,
  expectedReceiver?: Address
): Promise<ReceiptVerification> {
  const errors: string[] = [];

  // 1. Verify epoch is valid (not too old, not in future)
  const epochValid = isEpochValid(receipt.epoch);
  if (!epochValid) {
    errors.push(`Epoch ${receipt.epoch} is outside valid range`);
  }

  // 2. Verify sender matches if expected
  const senderMatches = !expectedSender || receipt.sender === expectedSender;
  if (!senderMatches) {
    errors.push(
      `Sender mismatch: expected ${expectedSender}, got ${receipt.sender}`
    );
  }

  // 3. Verify receiver matches if expected
  const receiverMatches =
    !expectedReceiver || receipt.receiver === expectedReceiver;
  if (!receiverMatches) {
    errors.push(
      `Receiver mismatch: expected ${expectedReceiver}, got ${receipt.receiver}`
    );
  }

  // 4. Reconstruct the message that should have been signed
  const message = constructReceiptMessage(
    receipt.contentHash,
    receipt.sender,
    receipt.receiver,
    receipt.size,
    receipt.epoch
  );

  // 5. Verify signature
  let signatureValid = false;
  const recoveredAddress = await verifyMessage({
    address: receipt.receiver,
    message,
    signature: receipt.signature,
  });
  signatureValid = recoveredAddress;

  if (!signatureValid) {
    errors.push('Invalid signature - receiver did not sign this receipt');
  }

  // 6. Verify content hash format
  const hashValid =
    receipt.contentHash.startsWith('0x') && receipt.contentHash.length === 66;
  if (!hashValid) {
    errors.push('Invalid content hash format');
  }

  return {
    valid: errors.length === 0,
    errors,
    details: {
      signatureValid,
      epochValid,
      hashValid,
      senderMatches,
      receiverMatches,
    },
  };
}

/**
 * Aggregate multiple receipts for efficient on-chain reporting
 *
 * Following PBTS Report algorithm:
 * "The tracker reconstructs receipts with timestamps and verifies
 * aggregate signature."
 */
export function aggregateReceipts(
  receipts: TransferReceipt[],
  sender: Address
): AggregatedReceipts {
  if (receipts.length === 0) {
    throw new Error('Cannot aggregate empty receipts');
  }

  // Filter receipts for this sender
  const senderReceipts = receipts.filter((r) => r.sender === sender);
  if (senderReceipts.length === 0) {
    throw new Error('No receipts for sender');
  }

  // Calculate totals
  const totalUploaded = senderReceipts.reduce((sum, r) => sum + r.size, 0);
  const epochs = senderReceipts.map((r) => r.epoch);
  const epochRange = {
    start: Math.min(...epochs),
    end: Math.max(...epochs),
  };

  // Create aggregate hash of all receipts
  const receiptHashes = senderReceipts.map((r) => r.contentHash).join(':');
  const aggregateHash = keccak256(toBytes(receiptHashes));

  return {
    sender,
    receiptIds: senderReceipts.map((r) => r.id),
    totalUploaded,
    aggregateHash,
    epochRange,
    receipts: senderReceipts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RECEIPT MANAGER (tracks receipts and prevents double-spending)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manages receipt collection and double-spend prevention
 *
 * Following PBTS: "short-term deduplication via a set Rrecent of
 * recently used receipt identifiers"
 */
export class ReceiptManager {
  private pendingReceipts: Map<string, TransferReceipt> = new Map();
  private usedReceipts: Set<string> = new Set(); // Rrecent in PBTS
  private verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  /**
   * Add a receipt to pending collection
   */
  addReceipt(receipt: TransferReceipt): void {
    // Check for double-spend
    if (this.usedReceipts.has(receipt.id)) {
      throw new Error(
        `Receipt ${receipt.id} has already been used (double-spend attempt)`
      );
    }

    this.pendingReceipts.set(receipt.id, receipt);

    if (this.verbose) {
      console.log(`[ReceiptManager] Added receipt: ${receipt.id}`);
    }
  }

  /**
   * Get pending receipts for a sender
   */
  getPendingReceipts(sender: Address): TransferReceipt[] {
    return Array.from(this.pendingReceipts.values()).filter(
      (r) => r.sender === sender
    );
  }

  /**
   * Mark receipts as used (after on-chain submission)
   */
  markAsUsed(receiptIds: string[]): void {
    for (const id of receiptIds) {
      this.pendingReceipts.delete(id);
      this.usedReceipts.add(id);
    }

    if (this.verbose) {
      console.log(
        `[ReceiptManager] Marked ${receiptIds.length} receipts as used`
      );
    }
  }

  /**
   * Check if a receipt has been used
   */
  isUsed(receiptId: string): boolean {
    return this.usedReceipts.has(receiptId);
  }

  /**
   * Clean up old used receipts (garbage collection)
   * Following PBTS: "periodic garbage collection"
   */
  cleanup(maxEpoch: number): void {
    const receiptsToRemove: string[] = [];

    for (const [id, receipt] of this.pendingReceipts) {
      if (receipt.epoch < maxEpoch - MAX_RECEIPT_AGE_EPOCHS) {
        receiptsToRemove.push(id);
      }
    }

    for (const id of receiptsToRemove) {
      this.pendingReceipts.delete(id);
    }

    if (this.verbose && receiptsToRemove.length > 0) {
      console.log(
        `[ReceiptManager] Cleaned up ${receiptsToRemove.length} expired receipts`
      );
    }
  }

  /**
   * Get statistics
   */
  getStats(): { pending: number; used: number } {
    return {
      pending: this.pendingReceipts.size,
      used: this.usedReceipts.size,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construct the message that receivers sign
 */
function constructReceiptMessage(
  contentHash: Hex,
  sender: Address,
  receiver: Address,
  size: number,
  epoch: number
): string {
  // Following PBTS format: m ← (contentHash ∥ sender ∥ size ∥ epoch)
  return `TRANSFER_RECEIPT:${contentHash}:${sender}:${receiver}:${size}:${epoch}`;
}

/**
 * Compute content hash for data
 */
export function computeContentHash(data: Uint8Array): Hex {
  return keccak256(data);
}
