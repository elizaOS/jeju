/**
 * DHT Fallback Protocol (PBTS-aligned)
 *
 * Based on Phala's PBTS paper Section 4.3:
 * > "We extend Kademlia with authentication to provide a DHT fallback
 * > preserving access control when the tracker is unavailable."
 *
 * This provides peer discovery when the centralized tracker is down,
 * using on-chain reputation as PKI for authentication.
 *
 * Key features from the paper:
 * 1. On-chain PKI: Registered users have on-chain public keys
 * 2. Authenticated announcements: Peers verify each other via signatures
 * 3. Reputation-gated access: Only users meeting MIN_REPUTATION can participate
 *
 * ⚠️ IMPLEMENTATION NOTE:
 * This is a simplified implementation. A full production version would use:
 * - libp2p with Kademlia DHT
 * - IPFS's peer discovery mechanisms
 * - Real P2P networking
 */

import type { Address, Hex } from 'viem';
import { verifyMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Peer information for DHT
 */
export interface PeerInfo {
  /** User's on-chain ID */
  userId: Hex;
  /** User's public key (address) */
  publicKey: Address;
  /** IP address or hostname */
  host: string;
  /** Port number */
  port: number;
  /** Signature proving ownership of publicKey */
  signature: Hex;
  /** Timestamp of announcement */
  timestamp: number;
  /** Reputation score (from on-chain) */
  reputation: number;
}

/**
 * Authenticated DHT announcement
 * Following PBTS: "peer Pi sends message m=(announce ∥ hT ∥ pki ∥ ipi ∥ porti)
 * with signature σi = Sign(ski,m)"
 */
export interface DHTAnnouncement {
  /** Content/torrent hash */
  contentHash: Hex;
  /** Announcing peer info */
  peer: PeerInfo;
  /** Event type */
  event: 'started' | 'stopped' | 'completed';
}

/**
 * On-chain user lookup result
 */
export interface OnChainUser {
  userId: Hex;
  publicKey: Address;
  uploaded: bigint;
  downloaded: bigint;
  active: boolean;
}

/**
 * Registry interface for on-chain lookups
 */
export interface OnChainRegistry {
  getUser(userId: Hex): Promise<OnChainUser | null>;
  getUserByAddress(address: Address): Promise<OnChainUser | null>;
  getMinReputation(): Promise<number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// DHT FALLBACK MANAGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manages DHT-based peer discovery when tracker is unavailable
 *
 * From PBTS paper:
 * > "The smart contract serves as PKI: registered users have on-chain
 * > public keys and reputation records. Peers authenticate DHT announcements
 * > using these credentials, admitting only users with sufficient reputation."
 */
export class DHTFallbackManager {
  private registry: OnChainRegistry;
  private localPeers: Map<Hex, Map<Address, PeerInfo>> = new Map(); // contentHash -> peers
  private bootstrapNodes: string[];
  private verbose: boolean;

  constructor(options: {
    registry: OnChainRegistry;
    bootstrapNodes?: string[];
    verbose?: boolean;
  }) {
    this.registry = options.registry;
    this.bootstrapNodes = options.bootstrapNodes ?? []; // Used for real DHT bootstrap
    this.verbose = options.verbose ?? false;
  }

  /**
   * Get bootstrap nodes (for real P2P implementation)
   */
  getBootstrapNodes(): string[] {
    return this.bootstrapNodes;
  }

  /**
   * Create an authenticated announcement
   */
  async createAnnouncement(
    privateKey: Hex,
    contentHash: Hex,
    host: string,
    port: number,
    event: DHTAnnouncement['event']
  ): Promise<DHTAnnouncement> {
    const account = privateKeyToAccount(privateKey);

    // Get user info from on-chain registry
    const user = await this.registry.getUserByAddress(account.address);
    if (!user) {
      throw new Error('User not registered on-chain');
    }

    // Check reputation
    const minRep = await this.registry.getMinReputation();
    const reputation = this.calculateReputation(user.uploaded, user.downloaded);
    if (reputation < minRep) {
      throw new Error(`Insufficient reputation: ${reputation} < ${minRep}`);
    }

    const timestamp = Date.now();

    // Sign announcement (following PBTS format)
    const message = this.constructAnnouncementMessage(
      contentHash,
      account.address,
      host,
      port,
      timestamp
    );
    const signature = await account.signMessage({ message });

    const peer: PeerInfo = {
      userId: user.userId,
      publicKey: account.address,
      host,
      port,
      signature,
      timestamp,
      reputation,
    };

    return { contentHash, peer, event };
  }

  /**
   * Process an incoming announcement
   *
   * Following PBTS:
   * > "Each node n verifies the signature and queries the smart contract...
   * > Node n accepts the announcement only if pk'i = pki and
   * > Rep(ui,di) ≥ MinRep"
   */
  async processAnnouncement(announcement: DHTAnnouncement): Promise<boolean> {
    const { contentHash, peer, event } = announcement;

    // 1. Verify user exists on-chain
    const user = await this.registry.getUser(peer.userId);
    if (!user) {
      if (this.verbose) {
        console.log(`[DHT] Rejected: User ${peer.userId} not registered`);
      }
      return false;
    }

    // 2. Verify public key matches on-chain record
    if (user.publicKey !== peer.publicKey) {
      if (this.verbose) {
        console.log(`[DHT] Rejected: Public key mismatch for ${peer.userId}`);
      }
      return false;
    }

    // 3. Check reputation
    const minRep = await this.registry.getMinReputation();
    const reputation = this.calculateReputation(user.uploaded, user.downloaded);
    if (reputation < minRep) {
      if (this.verbose) {
        console.log(
          `[DHT] Rejected: Insufficient reputation ${reputation} < ${minRep}`
        );
      }
      return false;
    }

    // 4. Verify signature
    const message = this.constructAnnouncementMessage(
      contentHash,
      peer.publicKey,
      peer.host,
      peer.port,
      peer.timestamp
    );

    const isValid = await verifyMessage({
      address: peer.publicKey,
      message,
      signature: peer.signature,
    });

    if (!isValid) {
      if (this.verbose) {
        console.log(`[DHT] Rejected: Invalid signature from ${peer.publicKey}`);
      }
      return false;
    }

    // 5. Check announcement freshness (5 minute window)
    const maxAge = 5 * 60 * 1000;
    if (Date.now() - peer.timestamp > maxAge) {
      if (this.verbose) {
        console.log(
          `[DHT] Rejected: Stale announcement from ${peer.publicKey}`
        );
      }
      return false;
    }

    // 6. Update local peer list
    if (event === 'stopped') {
      this.removePeer(contentHash, peer.publicKey);
    } else {
      this.addPeer(contentHash, peer);
    }

    if (this.verbose) {
      console.log(
        `[DHT] Accepted: ${event} from ${peer.publicKey} for ${contentHash.slice(0, 10)}...`
      );
    }

    return true;
  }

  /**
   * Get peers for a content hash
   */
  getPeers(contentHash: Hex, limit = 50): PeerInfo[] {
    const peers = this.localPeers.get(contentHash);
    if (!peers) return [];

    const peerList = Array.from(peers.values());

    // Shuffle and limit (following PBTS: "returns a random sample")
    return this.shuffleArray(peerList).slice(0, limit);
  }

  /**
   * Check if DHT fallback is needed
   */
  async isTrackerAvailable(trackerUrl: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(trackerUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private addPeer(contentHash: Hex, peer: PeerInfo): void {
    let peers = this.localPeers.get(contentHash);
    if (!peers) {
      peers = new Map();
      this.localPeers.set(contentHash, peers);
    }
    peers.set(peer.publicKey, peer);
  }

  private removePeer(contentHash: Hex, publicKey: Address): void {
    const peers = this.localPeers.get(contentHash);
    if (peers) {
      peers.delete(publicKey);
    }
  }

  private calculateReputation(uploaded: bigint, downloaded: bigint): number {
    if (downloaded === 0n) return Number.MAX_SAFE_INTEGER;
    return Number((uploaded * 100n) / downloaded);
  }

  private constructAnnouncementMessage(
    contentHash: Hex,
    publicKey: Address,
    host: string,
    port: number,
    timestamp: number
  ): string {
    return `DHT_ANNOUNCE:${contentHash}:${publicKey}:${host}:${port}:${timestamp}`;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }

  /**
   * Get statistics
   */
  getStats(): { contentCount: number; totalPeers: number } {
    let totalPeers = 0;
    for (const peers of this.localPeers.values()) {
      totalPeers += peers.size;
    }
    return {
      contentCount: this.localPeers.size,
      totalPeers,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK REGISTRY (for testing without real blockchain)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * In-memory registry for testing
 */
export class MockOnChainRegistry implements OnChainRegistry {
  private users: Map<Hex, OnChainUser> = new Map();
  private addressIndex: Map<Address, Hex> = new Map();
  private minReputation = 50; // 0.5 ratio

  async register(
    userId: Hex,
    publicKey: Address,
    initialCredit = 1000n
  ): Promise<void> {
    this.users.set(userId, {
      userId,
      publicKey,
      uploaded: initialCredit,
      downloaded: 0n,
      active: true,
    });
    this.addressIndex.set(publicKey, userId);
  }

  async getUser(userId: Hex): Promise<OnChainUser | null> {
    return this.users.get(userId) ?? null;
  }

  async getUserByAddress(address: Address): Promise<OnChainUser | null> {
    const userId = this.addressIndex.get(address);
    if (!userId) return null;
    return this.users.get(userId) ?? null;
  }

  async getMinReputation(): Promise<number> {
    return this.minReputation;
  }

  setMinReputation(value: number): void {
    this.minReputation = value;
  }
}
