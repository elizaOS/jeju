/**
 * File-based Storage
 *
 * A simple storage implementation that writes to local files.
 * Useful for testing and development when Arweave/IPFS is not needed.
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { keccak256 } from 'viem';
import type {
  Storage,
  StorageStats,
  UploadOptions,
  UploadResult,
} from './storage-interface.js';

export interface FileStorageConfig {
  /** Directory to store files */
  directory: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * File-based storage implementation
 */
export class FileStorage implements Storage {
  private config: FileStorageConfig;
  private stats: StorageStats = {
    objectCount: 0,
    totalSize: 0,
    encryptedCount: 0,
    publicCount: 0,
  };
  private initialized = false;

  constructor(config: FileStorageConfig) {
    this.config = config;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await mkdir(this.config.directory, { recursive: true });
    this.initialized = true;

    if (this.config.verbose) {
      console.log(`[FileStorage] Initialized at ${this.config.directory}`);
    }
  }

  /**
   * Generate a content ID from data
   */
  private generateId(data: Uint8Array): string {
    const hexString = `0x${Buffer.from(data).toString('hex')}` as const;
    const hash = keccak256(hexString);
    // Use first 24 chars of hash as ID (similar to IPFS CID length)
    return hash.slice(2, 26);
  }

  /**
   * Upload data to file storage
   */
  async upload(
    data: Uint8Array | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    await this.ensureInitialized();

    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const id = this.generateId(bytes);
    const filePath = join(this.config.directory, `${id}.bin`);
    const metaPath = join(this.config.directory, `${id}.json`);

    // Write data file
    await writeFile(filePath, bytes);

    // Write metadata file
    const metadata = {
      id,
      encrypted: options?.encrypted ?? false,
      tags: options?.tags ?? {},
      timestamp: Date.now(),
      size: bytes.length,
    };
    await writeFile(metaPath, JSON.stringify(metadata, null, 2));

    // Update stats
    this.stats.objectCount++;
    this.stats.totalSize += bytes.length;
    if (options?.encrypted) {
      this.stats.encryptedCount++;
    } else {
      this.stats.publicCount++;
    }

    if (this.config.verbose) {
      console.log(`[FileStorage] Saved ${id} (${bytes.length} bytes)`);
    }

    return {
      id,
      url: `file://${filePath}`,
      size: bytes.length,
      cost: '0',
    };
  }

  /**
   * Upload JSON to file storage
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
   * Download data from file storage
   */
  async download(id: string): Promise<Uint8Array> {
    const filePath = join(this.config.directory, `${id}.bin`);

    if (this.config.verbose) {
      console.log(`[FileStorage] Loading ${id}`);
    }

    const buffer = await readFile(filePath);
    return new Uint8Array(buffer);
  }

  /**
   * Download and parse JSON
   */
  async downloadJSON<T>(id: string): Promise<T> {
    const bytes = await this.download(id);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text) as T;
  }

  /**
   * Check if content exists
   */
  async exists(id: string): Promise<boolean> {
    const filePath = join(this.config.directory, `${id}.bin`);

    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the URL for a content ID
   */
  getUrl(id: string): string {
    return `file://${join(this.config.directory, `${id}.bin`)}`;
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    return { ...this.stats };
  }
}
