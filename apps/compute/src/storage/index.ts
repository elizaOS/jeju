/**
 * Storage Module - 100% PERMISSIONLESS
 *
 * ALL storage options work with wallet signature only - NO API KEYS.
 *
 * Production storage:
 * - PermissionlessStorage: Auto-switches between local IPFS and Arweave
 * - ArweaveStorage: Permanent storage via Irys (wallet signature)
 * - DecentralizedStorage: Multi-gateway with fallback
 * - FileStorage: Local file-based storage
 * - StateManager: Encrypted state management with Arweave
 */

// Production storage implementations
export {
  ArweaveStorage,
  type ArweaveStorageConfig,
  createDevnetStorage,
  createMainnetStorage,
} from './arweave-storage.js';
export {
  createArweaveStorage as createDecentralizedArweaveStorage,
  createDecentralizedStorage,
  createHybridStorage,
  createIPFSStorage,
  DecentralizedStorage,
  type DecentralizedStorageConfig,
  type DownloadResult,
  type GatewayHealth,
  type StorageLocation,
} from './decentralized-storage.js';
export { FileStorage, type FileStorageConfig } from './file-storage.js';
// 100% Permissionless storage (RECOMMENDED)
export {
  ARWEAVE_GATEWAYS,
  createArweaveOnlyStorage,
  createLocalIPFSStorage,
  createPermissionlessStorage,
  IPFS_GATEWAYS,
  PermissionlessStorage,
  type PermissionlessStorageConfig,
} from './permissionless-storage.js';

// State manager (encrypted state + public training data)
export {
  type StateCheckpoint,
  StateManager,
  type StateManagerConfig,
  type TrainingDataset,
} from './state-manager.js';

// Core interface
export type {
  Storage,
  StorageStats,
  UploadOptions,
  UploadResult,
} from './storage-interface.js';
