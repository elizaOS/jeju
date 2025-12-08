/**
 * State Manager - 100% PERMISSIONLESS
 *
 * Manages game state persistence using encrypted storage on Arweave.
 * All data is permanently stored with wallet signatures only.
 *
 * NO API KEYS. WALLET IS YOUR ONLY CREDENTIAL.
 */

import type { Hex } from 'viem';
import { keccak256, toBytes } from 'viem';
import type { TEEEnclave } from '../tee/enclave.js';
import type { SealedData } from '../tee/keystore.js';
import type { Storage } from './storage-interface.js';

export interface StateCheckpoint {
  /** Arweave transaction ID */
  id: string;
  /** Content hash (keccak256) */
  hash: Hex;
  /** Checkpoint version number */
  version: number;
  /** Key version used for encryption */
  keyVersion: number;
  /** Upload timestamp */
  timestamp: number;
  /** Size in bytes */
  size: number;
  /** Arweave URL */
  url: string;
}

export interface TrainingDataset {
  /** Arweave transaction ID */
  id: string;
  /** Training epoch */
  epoch: number;
  /** Number of training samples */
  sampleCount: number;
  /** Upload timestamp */
  timestamp: number;
  /** Model hash before training */
  modelHashBefore: Hex;
  /** Model hash after training */
  modelHashAfter: Hex;
  /** Arweave URL */
  url: string;
}

export interface StateManagerConfig {
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Manages encrypted game state and public training data using permanent storage
 */
export class StateManager {
  private enclave: TEEEnclave;
  private storage: Storage;
  private checkpoints: StateCheckpoint[] = [];
  private trainingDatasets: TrainingDataset[] = [];
  private currentEpoch = 0;
  private config: StateManagerConfig;

  constructor(
    enclave: TEEEnclave,
    storage: Storage,
    config: StateManagerConfig = {}
  ) {
    this.enclave = enclave;
    this.storage = storage;
    this.config = config;

    if (config.verbose) {
      console.log('[StateManager] Initialized with permanent storage');
    }
  }

  /**
   * Save encrypted game state to permanent storage
   */
  async saveState(state: object): Promise<StateCheckpoint> {
    // Encrypt state inside TEE
    const { hash } = await this.enclave.encryptState(state);

    // Get sealed data from enclave
    const sealed = this.enclave.getSealedState();
    if (!sealed) {
      throw new Error('Failed to get sealed state from enclave');
    }

    // Serialize sealed data for storage
    const sealedJson = JSON.stringify(sealed);

    if (this.config.verbose) {
      console.log(
        `[StateManager] Uploading encrypted state (${sealedJson.length} bytes)...`
      );
    }

    // Upload to permanent storage
    const result = await this.storage.upload(sealedJson, {
      encrypted: true,
      tags: {
        'Content-Type': 'application/json',
        'Data-Type': 'encrypted-game-state',
        'Key-Version': sealed.version.toString(),
        'State-Hash': hash,
      },
    });

    const checkpoint: StateCheckpoint = {
      id: result.id,
      hash,
      version: this.checkpoints.length + 1,
      keyVersion: sealed.version,
      timestamp: Date.now(),
      size: result.size,
      url: result.url,
    };

    this.checkpoints.push(checkpoint);

    if (this.config.verbose) {
      console.log(
        `[StateManager] ✓ Saved checkpoint v${checkpoint.version}: ${result.url}`
      );
    }

    return checkpoint;
  }

  /**
   * Load and decrypt state from permanent storage
   */
  async loadState<T = object>(id: string, keyVersion?: number): Promise<T> {
    if (this.config.verbose) {
      console.log(
        `[StateManager] Loading state from ${this.storage.getUrl(id)}...`
      );
    }

    // Download sealed blob from storage
    const sealedJson = await this.storage.downloadJSON<SealedData>(id);

    // Verify we got valid sealed data
    if (!sealedJson.payload || !sealedJson.version || !sealedJson.label) {
      throw new Error('Invalid sealed data structure');
    }

    // Decrypt inside TEE
    const state = await this.enclave.decryptState<T>(sealedJson, keyVersion);

    if (this.config.verbose) {
      console.log(`[StateManager] ✓ Loaded and decrypted state from ${id}`);
    }

    return state;
  }

  /**
   * Handle key rotation - re-encrypt and save state with new key
   */
  async rotateKey(): Promise<StateCheckpoint> {
    if (this.config.verbose) {
      console.log('\n[StateManager] === INITIATING KEY ROTATION ===');
    }

    // Tell enclave to rotate its key and re-encrypt state
    const { newVersion } = await this.enclave.rotateStateKey();

    // Get new sealed data
    const sealed = this.enclave.getSealedState();
    if (!sealed) {
      throw new Error('Failed to get re-encrypted state');
    }

    // Upload new sealed blob to permanent storage
    const sealedJson = JSON.stringify(sealed);
    const result = await this.storage.upload(sealedJson, {
      encrypted: true,
      tags: {
        'Content-Type': 'application/json',
        'Data-Type': 'encrypted-game-state',
        'Key-Version': sealed.version.toString(),
        'Rotated-From': (sealed.version - 1).toString(),
      },
    });

    const stateHash = keccak256(toBytes(sealedJson));
    const checkpoint: StateCheckpoint = {
      id: result.id,
      hash: stateHash,
      version: this.checkpoints.length + 1,
      keyVersion: newVersion,
      timestamp: Date.now(),
      size: result.size,
      url: result.url,
    };

    this.checkpoints.push(checkpoint);

    if (this.config.verbose) {
      console.log(
        `[StateManager] ✓ Key rotated to v${newVersion}, checkpoint: ${result.url}`
      );
    }

    return checkpoint;
  }

  /**
   * Save public training dataset to permanent storage
   */
  async saveTrainingData(
    data: object[],
    modelHashBefore: Hex,
    modelHashAfter: Hex
  ): Promise<TrainingDataset> {
    this.currentEpoch++;

    // Training data is stored publicly (not encrypted)
    const dataPayload = {
      epoch: this.currentEpoch,
      timestamp: Date.now(),
      samples: data,
      modelHashBefore,
      modelHashAfter,
    };

    if (this.config.verbose) {
      console.log(
        `[StateManager] Uploading training data epoch ${this.currentEpoch} (${data.length} samples)...`
      );
    }

    const result = await this.storage.uploadJSON(dataPayload, {
      encrypted: false,
      tags: {
        'Data-Type': 'public-training-data',
        Epoch: this.currentEpoch.toString(),
        'Sample-Count': data.length.toString(),
        'Model-Hash-Before': modelHashBefore,
        'Model-Hash-After': modelHashAfter,
      },
    });

    const dataset: TrainingDataset = {
      id: result.id,
      epoch: this.currentEpoch,
      sampleCount: data.length,
      timestamp: Date.now(),
      modelHashBefore,
      modelHashAfter,
      url: result.url,
    };

    this.trainingDatasets.push(dataset);

    if (this.config.verbose) {
      console.log(`[StateManager] ✓ Saved training data: ${result.url}`);
    }

    return dataset;
  }

  /**
   * Load public training dataset from permanent storage
   */
  async loadTrainingData(id: string): Promise<{
    epoch: number;
    timestamp: number;
    samples: object[];
    modelHashBefore: Hex;
    modelHashAfter: Hex;
  }> {
    return this.storage.downloadJSON(id);
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): StateCheckpoint[] {
    return [...this.checkpoints];
  }

  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(): StateCheckpoint | null {
    return this.checkpoints[this.checkpoints.length - 1] ?? null;
  }

  /**
   * Get all training datasets
   */
  getTrainingDatasets(): TrainingDataset[] {
    return [...this.trainingDatasets];
  }

  /**
   * Get current epoch
   */
  getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  /**
   * Get storage stats
   */
  getStats(): {
    checkpoints: number;
    trainingDatasets: number;
    totalStorageBytes: number;
  } {
    const storageStats = this.storage.getStats?.();
    return {
      checkpoints: this.checkpoints.length,
      trainingDatasets: this.trainingDatasets.length,
      totalStorageBytes: storageStats?.totalSize ?? 0,
    };
  }
}
