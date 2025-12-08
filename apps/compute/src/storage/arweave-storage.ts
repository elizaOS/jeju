/**
 * Arweave Storage (Real Implementation)
 *
 * Uses Irys (formerly Bundlr) for permanent, permissionless storage on Arweave.
 * - Pay with ETH (no need for AR tokens)
 * - Instant uploads with guaranteed finality
 * - Truly permanent - data lives forever
 *
 * For testing: Use devnet (free, no real tokens needed)
 * For production: Use mainnet (requires funded wallet)
 */

import Irys from '@irys/sdk';
import type { Hex } from 'viem';
import { keccak256 } from 'viem';
import type {
  Storage,
  StorageStats,
  UploadOptions,
  UploadResult,
} from './storage-interface.js';

export interface ArweaveStorageConfig {
  /** Network: 'mainnet' for production, 'devnet' for free testing */
  network: 'mainnet' | 'devnet';
  /** Private key for signing uploads (ETH format) */
  privateKey: Hex;
  /** Token to pay with (default: 'ethereum') */
  token?: 'ethereum' | 'matic' | 'solana' | 'arweave';
  /** Minimum balance before auto-funding (in atomic units) */
  minBalance?: bigint;
  /** Enable verbose logging */
  verbose?: boolean;
}

interface UploadReceipt {
  id: string;
  timestamp: number;
  version: string;
  deadlineHeight: number;
  public: string;
  signature: string;
}

/**
 * Real Arweave storage using Irys SDK
 */
export class ArweaveStorage implements Storage {
  private config: ArweaveStorageConfig;
  private irys: Irys | null = null;
  private stats: StorageStats = {
    objectCount: 0,
    totalSize: 0,
    encryptedCount: 0,
    publicCount: 0,
  };
  private initialized = false;

  constructor(config: ArweaveStorageConfig) {
    this.config = {
      token: 'ethereum',
      ...config,
    };
  }

  /**
   * Initialize the Irys client (lazy initialization)
   */
  private async ensureInitialized(): Promise<Irys> {
    if (this.irys && this.initialized) {
      return this.irys;
    }

    const url =
      this.config.network === 'mainnet'
        ? 'https://node1.irys.xyz'
        : 'https://devnet.irys.xyz';

    if (this.config.verbose) {
      console.log(`[ArweaveStorage] Connecting to ${url}...`);
    }

    // Remove 0x prefix for Irys
    const key = this.config.privateKey.startsWith('0x')
      ? this.config.privateKey.slice(2)
      : this.config.privateKey;

    this.irys = new Irys({
      url,
      token: this.config.token ?? 'ethereum',
      key,
    });

    await this.irys.ready();
    this.initialized = true;

    if (this.config.verbose) {
      const balance = await this.irys.getLoadedBalance();
      console.log(
        `[ArweaveStorage] Connected. Balance: ${this.irys.utils.fromAtomic(balance)} ${this.config.token}`
      );
    }

    return this.irys;
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<{ atomic: string; formatted: string }> {
    const irys = await this.ensureInitialized();
    const balance = await irys.getLoadedBalance();
    return {
      atomic: String(balance),
      formatted: String(irys.utils.fromAtomic(balance)),
    };
  }

  /**
   * Fund the Irys account (deposit tokens for storage)
   */
  async fund(amount: bigint): Promise<string> {
    const irys = await this.ensureInitialized();

    if (this.config.verbose) {
      console.log(
        `[ArweaveStorage] Funding with ${irys.utils.fromAtomic(amount)} ${this.config.token}...`
      );
    }

    const response = await irys.fund(amount);

    if (this.config.verbose) {
      console.log(`[ArweaveStorage] Funded. TX: ${response.id}`);
    }

    return response.id;
  }

  /**
   * Get the price to upload a given number of bytes
   */
  async getPrice(
    bytes: number
  ): Promise<{ atomic: string; formatted: string }> {
    const irys = await this.ensureInitialized();
    const price = await irys.getPrice(bytes);
    return {
      atomic: String(price),
      formatted: String(irys.utils.fromAtomic(price)),
    };
  }

  /**
   * Upload data to Arweave
   */
  async upload(
    data: Uint8Array | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const irys = await this.ensureInitialized();

    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    // Compute hash by converting bytes to hex string
    const hexString = `0x${Buffer.from(bytes).toString('hex')}` as const;
    const contentHash = keccak256(hexString);

    // Build tags
    const tags: { name: string; value: string }[] = [
      { name: 'Content-Hash', value: contentHash },
      { name: 'App-Name', value: 'babylon-experimental' },
      { name: 'Timestamp', value: Date.now().toString() },
    ];

    if (options?.encrypted) {
      tags.push({ name: 'Encrypted', value: 'true' });
    }

    if (options?.tags) {
      for (const [name, value] of Object.entries(options.tags)) {
        tags.push({ name, value });
      }
    }

    // Get price for this upload
    const price = await irys.getPrice(bytes.length);

    if (this.config.verbose) {
      console.log(
        `[ArweaveStorage] Uploading ${bytes.length} bytes (cost: ${irys.utils.fromAtomic(price)} ${this.config.token})...`
      );
    }

    // Upload to Arweave via Irys (accepts string or Buffer)
    const dataToUpload =
      typeof data === 'string' ? data : Buffer.from(bytes).toString();
    const receipt = (await irys.upload(dataToUpload, {
      tags,
    })) as UploadReceipt;

    if (this.config.verbose) {
      console.log(
        `[ArweaveStorage] Uploaded: https://arweave.net/${receipt.id}`
      );
    }

    // Update stats
    this.stats.objectCount++;
    this.stats.totalSize += bytes.length;
    if (options?.encrypted) {
      this.stats.encryptedCount++;
    } else {
      this.stats.publicCount++;
    }

    return {
      id: receipt.id,
      url: `https://arweave.net/${receipt.id}`,
      size: bytes.length,
      cost: price.toString(),
    };
  }

  /**
   * Upload JSON to Arweave
   */
  async uploadJSON(
    data: unknown,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const json = JSON.stringify(data);
    return this.upload(json, {
      ...options,
      tags: {
        'Content-Type': 'application/json',
        ...options?.tags,
      },
    });
  }

  /**
   * Download data from Arweave
   */
  async download(id: string): Promise<Uint8Array> {
    const url = `https://arweave.net/${id}`;

    if (this.config.verbose) {
      console.log(`[ArweaveStorage] Downloading from ${url}...`);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download ${id}: ${response.status} ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /**
   * Download and parse JSON from Arweave
   */
  async downloadJSON<T>(id: string): Promise<T> {
    const bytes = await this.download(id);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text) as T;
  }

  /**
   * Check if content exists on Arweave
   */
  async exists(id: string): Promise<boolean> {
    const response = await fetch(`https://arweave.net/${id}`, {
      method: 'HEAD',
    });
    return response.ok;
  }

  /**
   * Get the gateway URL for a content ID
   */
  getUrl(id: string): string {
    return `https://arweave.net/${id}`;
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    return { ...this.stats };
  }
}

/**
 * Create an Arweave storage client for the devnet (free testing)
 */
export function createDevnetStorage(
  privateKey: Hex,
  verbose = false
): ArweaveStorage {
  return new ArweaveStorage({
    network: 'devnet',
    privateKey,
    token: 'ethereum',
    verbose,
  });
}

/**
 * Create an Arweave storage client for mainnet (production)
 */
export function createMainnetStorage(
  privateKey: Hex,
  verbose = false
): ArweaveStorage {
  return new ArweaveStorage({
    network: 'mainnet',
    privateKey,
    token: 'ethereum',
    verbose,
  });
}
