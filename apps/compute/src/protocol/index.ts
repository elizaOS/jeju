/**
 * Protocol Module Exports
 *
 * Implements decentralized protocols aligned with Phala PBTS paper:
 * https://eprint.iacr.org/2025/2131.pdf
 */

// Commit-Reveal Protocol (prevents front-running)
export {
  type Commitment,
  type CommitRevealConfig,
  CommitRevealManager,
  computeDataHash,
  type Reveal,
  verifyDataHash,
} from './commit-reveal.js';
// DHT Fallback (authenticated P2P discovery)
export {
  type DHTAnnouncement,
  DHTFallbackManager,
  MockOnChainRegistry,
  type OnChainRegistry,
  type OnChainUser,
  type PeerInfo,
} from './dht-fallback.js';

// Peer Attestation (PBTS-aligned transfer receipts)
export {
  type AggregatedReceipts,
  aggregateReceipts,
  computeContentHash,
  createReceipt,
  getCurrentEpoch,
  isEpochValid,
  ReceiptManager,
  type ReceiptVerification,
  type TransferReceipt,
  verifyReceipt,
} from './peer-attestation.js';
// Verifier Client (external verification)
export {
  auditEncryptedData,
  type DataIntegrityResult,
  type NetworkState,
  type VerificationCheck,
  type VerificationReport,
  VerifierClient,
} from './verifier-client.js';
