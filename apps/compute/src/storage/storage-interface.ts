/**
 * Storage Interface
 *
 * Abstract interface for permanent, content-addressed storage.
 * Implementations can use Arweave/Irys, IPFS, or in-memory for testing.
 */

export interface StoredObject {
  /** Content identifier (Arweave txId or IPFS CID) */
  id: string;
  /** Original content */
  content: Uint8Array;
  /** Content hash (keccak256) */
  contentHash: string;
  /** Whether content is encrypted */
  encrypted: boolean;
  /** Upload timestamp */
  timestamp: number;
  /** Size in bytes */
  size: number;
  /** Optional metadata tags */
  tags?: Record<string, string>;
}

export interface UploadOptions {
  /** Mark as encrypted content */
  encrypted?: boolean;
  /** Metadata tags for the upload */
  tags?: Record<string, string>;
}

export interface UploadResult {
  /** Content identifier */
  id: string;
  /** Full URL to access the content */
  url: string;
  /** Size in bytes */
  size: number;
  /** Cost of storage (in atomic units) */
  cost: string;
}

export interface StorageStats {
  objectCount: number;
  totalSize: number;
  encryptedCount: number;
  publicCount: number;
}

/**
 * Abstract storage interface for content-addressed storage
 */
export interface Storage {
  /**
   * Upload data and return a permanent content ID
   */
  upload(
    data: Uint8Array | string,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Upload JSON data
   */
  uploadJSON(data: unknown, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Download data by content ID
   */
  download(id: string): Promise<Uint8Array>;

  /**
   * Download and parse JSON
   */
  downloadJSON<T>(id: string): Promise<T>;

  /**
   * Check if content exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Get the gateway URL for a content ID
   */
  getUrl(id: string): string;

  /**
   * Get storage statistics (if available)
   */
  getStats?(): StorageStats;
}
