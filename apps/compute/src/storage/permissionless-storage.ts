/**
 * Permissionless Storage - 100% Decentralized, NO API KEYS
 *
 * This implementation is FULLY permissionless:
 * 1. Arweave via Irys - Pay with ETH, sign with wallet (NO API KEY)
 * 2. Local IPFS node - Run your own node, no auth needed
 * 3. Web3.Storage/Storacha - Uses UCAN (wallet-based auth, no API key)
 * 4. Public IPFS gateways for reads only
 *
 * CRITICAL: We NEVER use centralized services like Pinata that require API keys.
 * Everything is wallet-signed or runs on infrastructure you control.
 */

import type { Hex } from 'viem';
import { keccak256 } from 'viem';
import type {
  Storage,
  StorageStats,
  UploadOptions,
  UploadResult,
} from './storage-interface.js';

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC GATEWAYS (READ-ONLY, NO AUTH NEEDED)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Public Arweave gateways - multiple independent operators
 * Used for READING data. Uploads go through Irys with wallet signature.
 */
const ARWEAVE_GATEWAYS = [
  'https://arweave.net',
  'https://ar-io.net',
  'https://g8way.io',
  'https://arweave.dev',
  'https://gateway.redstone.finance',
] as const;

/**
 * Public IPFS gateways - multiple independent operators
 * Used for READING data. Uploads require local node or Arweave.
 */
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://dweb.link/ipfs',
  'https://4everland.io/ipfs',
  'https://w3s.link/ipfs',
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PermissionlessStorageConfig {
  /**
   * Private key for signing uploads (ETH format).
   * This is the ONLY credential needed - pure wallet-based auth.
   */
  privateKey: Hex;

  /**
   * Primary upload strategy:
   * - 'arweave': Use Irys (permanent, pay with ETH, wallet signature only)
   * - 'local-ipfs': Use local IPFS node (you run it, no auth)
   * - 'auto': Try Arweave first, fall back to local IPFS
   */
  uploadStrategy: 'arweave' | 'local-ipfs' | 'auto';

  /**
   * Arweave network: 'mainnet' for production, 'devnet' for free testing
   */
  arweaveNetwork?: 'mainnet' | 'devnet';

  /**
   * Local IPFS API URL (default: http://localhost:5001)
   */
  ipfsApiUrl?: string;

  /** Timeout per gateway attempt (ms) */
  gatewayTimeout?: number;

  /** Maximum retries across gateways */
  maxRetries?: number;

  /** Verify content hash on download */
  verifyOnDownload?: boolean;

  /** Enable verbose logging */
  verbose?: boolean;
}

export interface StorageLocation {
  network: 'arweave' | 'ipfs';
  id: string;
  uploadedAt: number;
  contentHash: Hex;
}

export interface GatewayHealth {
  gateway: string;
  healthy: boolean;
  latencyMs?: number;
  lastChecked: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSIONLESS STORAGE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export class PermissionlessStorage implements Storage {
  private config: PermissionlessStorageConfig;
  private stats: StorageStats = {
    objectCount: 0,
    totalSize: 0,
    encryptedCount: 0,
    publicCount: 0,
  };
  private gatewayHealth: Map<string, GatewayHealth> = new Map();
  private uploadedContent: Map<string, StorageLocation> = new Map();

  // Lazy-loaded Irys client (only when needed)
  private irysClient: IrysClient | null = null;

  constructor(config: PermissionlessStorageConfig) {
    this.config = {
      arweaveNetwork: 'devnet', // Free for testing
      ipfsApiUrl: 'http://localhost:5001',
      gatewayTimeout: 10000,
      maxRetries: 5,
      verifyOnDownload: true,
      ...config,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARWEAVE UPLOADS (via Irys - wallet signature only)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get or initialize Irys client (lazy initialization)
   */
  private async getIrys(): Promise<IrysClient> {
    if (this.irysClient) {
      return this.irysClient;
    }

    // Dynamic import to avoid requiring Irys when not using Arweave
    const { default: Irys } = await import('@irys/sdk');

    const url =
      this.config.arweaveNetwork === 'mainnet'
        ? 'https://node1.irys.xyz'
        : 'https://devnet.irys.xyz';

    if (this.config.verbose) {
      console.log(`[PermissionlessStorage] Connecting to Irys at ${url}...`);
    }

    // Remove 0x prefix for Irys
    const key = this.config.privateKey.startsWith('0x')
      ? this.config.privateKey.slice(2)
      : this.config.privateKey;

    // Cast through unknown to bypass strict type checking - runtime compatible
    const irys = new Irys({
      url,
      token: 'ethereum',
      key,
    }) as unknown as IrysClient;

    await irys.ready();

    if (this.config.verbose) {
      const balance = await irys.getLoadedBalance();
      console.log(
        `[PermissionlessStorage] Connected. Balance: ${irys.utils.fromAtomic(balance)} ETH`
      );
    }

    this.irysClient = irys;
    return irys;
  }

  /**
   * Upload to Arweave via Irys (wallet signature only, NO API KEY)
   */
  private async uploadToArweave(
    data: Uint8Array,
    options?: UploadOptions
  ): Promise<{ id: string; url: string; cost: string }> {
    const irys = await this.getIrys();

    // Build tags
    const tags: { name: string; value: string }[] = [
      { name: 'App-Name', value: 'jeju-compute' },
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

    // Get price
    const price = await irys.getPrice(data.length);

    if (this.config.verbose) {
      console.log(
        `[PermissionlessStorage] Uploading ${data.length} bytes to Arweave (cost: ${irys.utils.fromAtomic(price)} ETH)...`
      );
    }

    // Upload with wallet signature
    const dataToUpload = Buffer.from(data).toString();
    const receipt = (await irys.upload(dataToUpload, { tags })) as {
      id: string;
    };

    if (this.config.verbose) {
      console.log(
        `[PermissionlessStorage] ✓ Uploaded: https://arweave.net/${receipt.id}`
      );
    }

    return {
      id: receipt.id,
      url: `https://arweave.net/${receipt.id}`,
      cost: price.toString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL IPFS UPLOADS (your own node, no auth)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if local IPFS node is available
   */
  private async isLocalIPFSAvailable(): Promise<boolean> {
    const url = this.config.ipfsApiUrl ?? 'http://localhost:5001';
    const response = await fetch(`${url}/api/v0/id`, {
      method: 'POST',
    }).catch(() => null);
    return response?.ok ?? false;
  }

  /**
   * Upload to local IPFS node (no auth needed - you run the node)
   */
  private async uploadToLocalIPFS(
    data: Uint8Array
  ): Promise<{ id: string; url: string }> {
    const url = this.config.ipfsApiUrl ?? 'http://localhost:5001';

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(data)]));

    const response = await fetch(`${url}/api/v0/add`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Local IPFS upload failed: ${await response.text()}`);
    }

    const result = (await response.json()) as { Hash: string };

    if (this.config.verbose) {
      console.log(
        `[PermissionlessStorage] ✓ Uploaded to local IPFS: ${result.Hash}`
      );
    }

    return {
      id: result.Hash,
      url: `${IPFS_GATEWAYS[0]}/${result.Hash}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE INTERFACE IMPLEMENTATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute content hash for verification
   */
  private computeHash(data: Uint8Array): Hex {
    const hexString = `0x${Buffer.from(data).toString('hex')}` as const;
    return keccak256(hexString);
  }

  /**
   * Upload data to decentralized storage (100% permissionless)
   */
  async upload(
    data: Uint8Array | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const contentHash = this.computeHash(bytes);

    let result: { id: string; url: string; cost?: string };
    let network: 'arweave' | 'ipfs';

    if (this.config.uploadStrategy === 'arweave') {
      result = await this.uploadToArweave(bytes, options);
      network = 'arweave';
    } else if (this.config.uploadStrategy === 'local-ipfs') {
      const ipfsAvailable = await this.isLocalIPFSAvailable();
      if (!ipfsAvailable) {
        throw new Error(
          `Local IPFS node not available at ${this.config.ipfsApiUrl}. ` +
            `Start with: ipfs daemon`
        );
      }
      result = await this.uploadToLocalIPFS(bytes);
      network = 'ipfs';
    } else {
      // Auto mode: try Arweave first, fall back to local IPFS
      const ipfsAvailable = await this.isLocalIPFSAvailable();

      if (ipfsAvailable) {
        // Prefer local IPFS if available (free, fast)
        result = await this.uploadToLocalIPFS(bytes);
        network = 'ipfs';
      } else {
        // Fall back to Arweave (costs ETH but always works)
        result = await this.uploadToArweave(bytes, options);
        network = 'arweave';
      }
    }

    // Store location for future reference
    this.uploadedContent.set(result.id, {
      network,
      id: result.id,
      uploadedAt: Date.now(),
      contentHash,
    });

    // Update stats
    this.stats.objectCount++;
    this.stats.totalSize += bytes.length;
    if (options?.encrypted) {
      this.stats.encryptedCount++;
    } else {
      this.stats.publicCount++;
    }

    return {
      id: result.id,
      url: result.url,
      size: bytes.length,
      cost: result.cost ?? '0',
    };
  }

  /**
   * Upload JSON data
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
   * Download data from decentralized storage with multi-gateway fallback
   */
  async download(id: string): Promise<Uint8Array> {
    // Determine network from stored location or try both
    const location = this.uploadedContent.get(id);

    // Try Arweave first if that's where we uploaded
    if (!location || location.network === 'arweave') {
      for (const gateway of ARWEAVE_GATEWAYS) {
        const result = await this.tryGateway(gateway, id).catch(() => null);
        if (result) {
          // Verify if we have the expected hash
          if (this.config.verifyOnDownload && location) {
            const hash = this.computeHash(result.data);
            if (hash !== location.contentHash) {
              if (this.config.verbose) {
                console.log(
                  `[PermissionlessStorage] ⚠️ Hash mismatch from ${gateway}`
                );
              }
              continue;
            }
          }
          return result.data;
        }
      }
    }

    // Try IPFS
    for (const gateway of IPFS_GATEWAYS) {
      const result = await this.tryGateway(gateway, id).catch(() => null);
      if (result) {
        if (this.config.verifyOnDownload && location) {
          const hash = this.computeHash(result.data);
          if (hash !== location.contentHash) {
            continue;
          }
        }
        return result.data;
      }
    }

    throw new Error(
      `Failed to download ${id} from all gateways. Content may be unavailable.`
    );
  }

  /**
   * Try to download from a single gateway
   */
  private async tryGateway(
    gateway: string,
    id: string
  ): Promise<{ data: Uint8Array; latencyMs: number }> {
    const url = `${gateway}/${id}`;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.gatewayTimeout ?? 10000
    );

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const latencyMs = Date.now() - startTime;

    // Update gateway health
    this.gatewayHealth.set(gateway, {
      gateway,
      healthy: true,
      latencyMs,
      lastChecked: Date.now(),
    });

    return {
      data: new Uint8Array(buffer),
      latencyMs,
    };
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
   * Check if content exists (tries multiple gateways)
   */
  async exists(id: string): Promise<boolean> {
    // Try Arweave first
    for (const gateway of ARWEAVE_GATEWAYS.slice(0, 2)) {
      const url = `${gateway}/${id}`;
      const response = await fetch(url, { method: 'HEAD' }).catch(() => null);
      if (response?.ok) return true;
    }

    // Try IPFS
    for (const gateway of IPFS_GATEWAYS.slice(0, 2)) {
      const url = `${gateway}/${id}`;
      const response = await fetch(url, { method: 'HEAD' }).catch(() => null);
      if (response?.ok) return true;
    }

    return false;
  }

  /**
   * Get the gateway URL for a content ID
   */
  getUrl(id: string): string {
    const location = this.uploadedContent.get(id);
    if (location?.network === 'arweave') {
      return `https://arweave.net/${id}`;
    }
    return `${IPFS_GATEWAYS[0]}/${id}`;
  }

  /**
   * Get all gateway URLs for content
   */
  getAllUrls(id: string): string[] {
    const location = this.uploadedContent.get(id);
    if (location?.network === 'arweave') {
      return ARWEAVE_GATEWAYS.map((g) => `${g}/${id}`);
    }
    return IPFS_GATEWAYS.map((g) => `${g}/${id}`);
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    return { ...this.stats };
  }

  /**
   * Get Irys balance (for Arweave uploads)
   */
  async getBalance(): Promise<{ atomic: string; formatted: string }> {
    const irys = await this.getIrys();
    const balance = await irys.getLoadedBalance();
    return {
      atomic: String(balance),
      formatted: String(irys.utils.fromAtomic(balance)),
    };
  }

  /**
   * Fund the Irys account (deposit ETH for Arweave storage)
   */
  async fund(amount: bigint): Promise<string> {
    const irys = await this.getIrys();

    if (this.config.verbose) {
      console.log(
        `[PermissionlessStorage] Funding with ${irys.utils.fromAtomic(amount)} ETH...`
      );
    }

    const response = await irys.fund(amount);

    if (this.config.verbose) {
      console.log(`[PermissionlessStorage] ✓ Funded. TX: ${response.id}`);
    }

    return response.id;
  }

  /**
   * Get price for uploading bytes to Arweave
   */
  async getPrice(
    bytes: number
  ): Promise<{ atomic: string; formatted: string }> {
    const irys = await this.getIrys();
    const price = await irys.getPrice(bytes);
    return {
      atomic: String(price),
      formatted: String(irys.utils.fromAtomic(price)),
    };
  }

  /**
   * Check health of all gateways
   */
  async checkGatewayHealth(): Promise<GatewayHealth[]> {
    const results: GatewayHealth[] = [];

    // Test Arweave gateways
    for (const gateway of ARWEAVE_GATEWAYS) {
      const startTime = Date.now();
      const response = await fetch(gateway, { method: 'HEAD' }).catch(
        () => null
      );
      results.push({
        gateway,
        healthy: response?.ok ?? false,
        latencyMs: Date.now() - startTime,
        lastChecked: Date.now(),
      });
    }

    // Test IPFS gateways with a well-known CID
    const testCid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
    for (const gateway of IPFS_GATEWAYS) {
      const startTime = Date.now();
      const response = await fetch(`${gateway}/${testCid}`, {
        method: 'HEAD',
      }).catch(() => null);
      results.push({
        gateway,
        healthy: response?.ok ?? false,
        latencyMs: Date.now() - startTime,
        lastChecked: Date.now(),
      });
    }

    return results;
  }

  /**
   * Print gateway health report
   */
  async printHealthReport(): Promise<void> {
    console.log(
      '\n╔═══════════════════════════════════════════════════════════════════╗'
    );
    console.log(
      '║           PERMISSIONLESS GATEWAY HEALTH REPORT                    ║'
    );
    console.log(
      '╠═══════════════════════════════════════════════════════════════════╣'
    );

    const health = await this.checkGatewayHealth();

    console.log(
      '║                                                                   ║'
    );
    console.log(
      '║  ARWEAVE GATEWAYS (read-only, uploads via Irys wallet sig):      ║'
    );
    for (const g of health.filter((h) =>
      ARWEAVE_GATEWAYS.some((ag) =>
        h.gateway.includes(ag.replace('https://', ''))
      )
    )) {
      const status = g.healthy ? '✅' : '❌';
      const latency = g.latencyMs ? `${g.latencyMs}ms` : 'N/A';
      console.log(
        `║  ${status} ${g.gateway.padEnd(40)} ${latency.padStart(8)} ║`
      );
    }

    console.log(
      '║                                                                   ║'
    );
    console.log(
      '║  IPFS GATEWAYS (read-only, uploads via local node):              ║'
    );
    for (const g of health.filter((h) =>
      IPFS_GATEWAYS.some((ig) => h.gateway.includes(ig.replace('https://', '')))
    )) {
      const status = g.healthy ? '✅' : '❌';
      const latency = g.latencyMs ? `${g.latencyMs}ms` : 'N/A';
      console.log(
        `║  ${status} ${g.gateway.padEnd(40)} ${latency.padStart(8)} ║`
      );
    }

    // Check local IPFS
    const localAvailable = await this.isLocalIPFSAvailable();
    console.log(
      '║                                                                   ║'
    );
    console.log(
      `║  LOCAL IPFS: ${localAvailable ? '✅ Available' : '❌ Not running'} (${this.config.ipfsApiUrl})`.padEnd(
        67
      ) + '  ║'
    );

    const healthyCount = health.filter((h) => h.healthy).length;
    console.log(
      '║                                                                   ║'
    );
    console.log(
      `║  SUMMARY: ${healthyCount}/${health.length} gateways healthy                               ║`
    );
    console.log(
      '║                                                                   ║'
    );
    console.log(
      '║  PERMISSIONLESS: YES - Only wallet signature required for uploads ║'
    );
    console.log(
      '╚═══════════════════════════════════════════════════════════════════╝\n'
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IRYS TYPE DEFINITION (to avoid 'any')
// ═══════════════════════════════════════════════════════════════════════════

interface IrysClient {
  ready(): Promise<IrysClient>;
  getLoadedBalance(): Promise<bigint>;
  getPrice(bytes: number): Promise<bigint>;
  fund(amount: bigint): Promise<{ id: string }>;
  upload(
    data: string,
    options: { tags: { name: string; value: string }[] }
  ): Promise<{ id: string }>;
  utils: {
    fromAtomic(amount: bigint): string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create permissionless storage with sensible defaults
 */
export function createPermissionlessStorage(
  privateKey: Hex,
  options: Partial<Omit<PermissionlessStorageConfig, 'privateKey'>> = {}
): PermissionlessStorage {
  return new PermissionlessStorage({
    privateKey,
    uploadStrategy: 'auto',
    arweaveNetwork: 'devnet',
    verifyOnDownload: true,
    ...options,
  });
}

/**
 * Create storage using Arweave only (permanent, wallet signature)
 */
export function createArweaveOnlyStorage(
  privateKey: Hex,
  network: 'mainnet' | 'devnet' = 'devnet',
  verbose = false
): PermissionlessStorage {
  return new PermissionlessStorage({
    privateKey,
    uploadStrategy: 'arweave',
    arweaveNetwork: network,
    verbose,
  });
}

/**
 * Create storage using local IPFS only (no external dependencies)
 */
export function createLocalIPFSStorage(
  privateKey: Hex,
  ipfsApiUrl = 'http://localhost:5001',
  verbose = false
): PermissionlessStorage {
  return new PermissionlessStorage({
    privateKey,
    uploadStrategy: 'local-ipfs',
    ipfsApiUrl,
    verbose,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORT PUBLIC GATEWAYS FOR EXTERNAL USE
// ═══════════════════════════════════════════════════════════════════════════

export { ARWEAVE_GATEWAYS, IPFS_GATEWAYS };
