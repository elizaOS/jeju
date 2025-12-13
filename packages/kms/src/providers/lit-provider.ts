/**
 * Lit Protocol Provider
 *
 * Encryption provider with two modes:
 *
 * 1. FALLBACK MODE (default): Uses local AES-256-GCM encryption when Lit
 *    Protocol network is unavailable. This is the tested, working mode.
 *    Data is encrypted with a key derived from KMS_FALLBACK_SECRET env var.
 *
 * 2. LIT PROTOCOL MODE: When connected to Lit network, uses distributed
 *    threshold encryption with programmable access control conditions.
 *    Requires network connectivity to Lit nodes.
 *
 * Current status: FALLBACK MODE is always used in development/testing.
 * Lit Protocol integration requires network access and is not tested.
 */

import { keccak256, toBytes } from 'viem';
import type { Address, Hex } from 'viem';
import {
  type AccessCondition,
  type AccessControlPolicy,
  type AuthSignature,
  type DecryptRequest,
  type EncryptedPayload,
  type EncryptRequest,
  type GeneratedKey,
  type KeyCurve,
  type KeyMetadata,
  type KeyType,
  type KMSProvider,
  KMSProviderType,
  type LitConfig,
  type SessionKey,
  type SignedMessage,
  type SignRequest,
  ConditionOperator,
} from '../types.js';

// ============================================================================
// Lit Protocol SDK Types (dynamically imported)
// ============================================================================

interface LitNodeClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ready: boolean;
}

interface LitSDK {
  LitNodeClient: new (config: { litNetwork: string; debug?: boolean }) => LitNodeClient;
  encryptString: (
    params: {
      accessControlConditions: LitAccessCondition[];
      chain: string;
      dataToEncrypt: string;
    },
    client: LitNodeClient
  ) => Promise<{ ciphertext: string; dataToEncryptHash: string }>;
  decryptString: (
    params: {
      ciphertext: string;
      dataToEncryptHash: string;
      accessControlConditions: LitAccessCondition[];
      chain: string;
    },
    client: LitNodeClient,
    authSig: LitAuthSig
  ) => Promise<string>;
}

interface LitAccessCondition {
  contractAddress: string;
  standardContractType: string;
  chain: string;
  method: string;
  parameters: string[];
  returnValueTest: {
    comparator: string;
    value: string;
  };
}

interface LitAuthSig {
  sig: string;
  derivedVia: string;
  signedMessage: string;
  address: string;
}

// ============================================================================
// Provider Implementation
// ============================================================================

export class LitProvider implements KMSProvider {
  type = KMSProviderType.LIT;

  private config: LitConfig;
  private client: LitNodeClient | null = null;
  private sdk: LitSDK | null = null;
  private keys: Map<string, KeyMetadata> = new Map();
  private fallbackKey: Uint8Array | null = null;

  constructor(config: LitConfig) {
    this.config = config;
    this.initFallbackKey();
  }

  private initFallbackKey(): void {
    const secret = process.env.KMS_FALLBACK_SECRET ?? process.env.TEE_ENCRYPTION_SECRET ?? 'jeju-kms-dev';
    const hash = keccak256(toBytes(secret));
    this.fallbackKey = toBytes(hash);
  }

  async isAvailable(): Promise<boolean> {
    if (this.client?.ready) return true;

    try {
      await this.connect();
      // Available if connected OR if fallback is available
      return this.client?.ready ?? this.fallbackKey !== null;
    } catch {
      // Fallback encryption is always available
      return this.fallbackKey !== null;
    }
  }

  async connect(): Promise<void> {
    if (this.client?.ready) return;

    try {
      const module = await import('@lit-protocol/lit-node-client');
      this.sdk = module as unknown as LitSDK;

      this.client = new this.sdk.LitNodeClient({
        litNetwork: this.config.network,
        debug: this.config.debug ?? false,
      });

      await this.client.connect();
      console.log('[LitProvider] Connected to network:', this.config.network);
    } catch (error) {
      console.warn('[LitProvider] Connection failed, fallback mode enabled:', (error as Error).message);
      this.client = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  // ========================================================================
  // Key Management
  // ========================================================================

  async generateKey(
    owner: Address,
    keyType: KeyType,
    curve: KeyCurve,
    policy: AccessControlPolicy
  ): Promise<GeneratedKey> {
    const keyId = this.generateKeyId();
    const createdAt = Date.now();

    // For Lit Protocol, we don't actually generate keys locally
    // Keys are derived per-encryption using access conditions
    // This creates a virtual key reference

    const metadata: KeyMetadata = {
      id: keyId,
      type: keyType,
      curve,
      createdAt,
      owner,
      policy,
      providerType: KMSProviderType.LIT,
    };

    this.keys.set(keyId, metadata);

    // Generate deterministic public key for reference
    const publicKey = keccak256(toBytes(`${keyId}:${owner}:${createdAt}`)) as Hex;

    return {
      metadata,
      publicKey,
    };
  }

  getKey(keyId: string): KeyMetadata | null {
    return this.keys.get(keyId) ?? null;
  }

  async revokeKey(keyId: string): Promise<void> {
    this.keys.delete(keyId);
    // Note: For Lit, revocation is handled by changing access conditions
    // The key itself cannot be revoked - only access to decrypt can be removed
  }

  // ========================================================================
  // Encryption
  // ========================================================================

  async encrypt(request: EncryptRequest): Promise<EncryptedPayload> {
    const dataStr = typeof request.data === 'string' 
      ? request.data 
      : new TextDecoder().decode(request.data);

    const encryptedAt = Math.floor(Date.now() / 1000);
    const keyId = request.keyId ?? this.generateKeyId();
    const accessControlConditions = this.policyToLitConditions(request.policy);
    const accessControlHash = keccak256(toBytes(JSON.stringify(accessControlConditions)));
    const dataHash = keccak256(toBytes(dataStr));

    if (this.client && this.sdk) {
      // Use Lit Protocol for real encryption
      const { ciphertext, dataToEncryptHash } = await this.sdk.encryptString(
        {
          accessControlConditions,
          chain: this.getChainFromPolicy(request.policy),
          dataToEncrypt: dataStr,
        },
        this.client
      );

      return {
        ciphertext,
        dataHash: dataToEncryptHash as Hex,
        accessControlHash,
        policy: request.policy,
        providerType: KMSProviderType.LIT,
        encryptedAt,
        keyId,
        metadata: request.metadata,
      };
    }

    // Fallback: AES-256-GCM encryption
    const { ciphertext, iv, tag } = await this.fallbackEncrypt(dataStr);

    return {
      ciphertext: JSON.stringify({ ciphertext, iv, tag, fallback: true }),
      dataHash,
      accessControlHash,
      policy: request.policy,
      providerType: KMSProviderType.LIT,
      encryptedAt,
      keyId,
      metadata: { ...request.metadata, fallback: 'true' },
    };
  }

  async decrypt(request: DecryptRequest): Promise<string> {
    const { payload, authSig } = request;

    // Check if this is fallback-encrypted data
    if (payload.metadata?.fallback === 'true') {
      const parsed = JSON.parse(payload.ciphertext) as {
        ciphertext: string;
        iv: string;
        tag: string;
      };
      return this.fallbackDecrypt(parsed.ciphertext, parsed.iv, parsed.tag);
    }

    if (!this.client || !this.sdk) {
      throw new Error('Lit Protocol not available and data is not fallback-encrypted');
    }

    if (!authSig) {
      throw new Error('Auth signature required for Lit Protocol decryption');
    }

    const accessControlConditions = this.policyToLitConditions(payload.policy);

    const decrypted = await this.sdk.decryptString(
      {
        ciphertext: payload.ciphertext,
        dataToEncryptHash: payload.dataHash,
        accessControlConditions,
        chain: this.getChainFromPolicy(payload.policy),
      },
      this.client,
      {
        sig: authSig.sig,
        derivedVia: authSig.derivedVia,
        signedMessage: authSig.signedMessage,
        address: authSig.address,
      }
    );

    return decrypted;
  }

  // ========================================================================
  // Signing (via Lit Actions / PKPs)
  // ========================================================================

  async sign(_request: SignRequest): Promise<SignedMessage> {
    // Lit Protocol signing requires PKPs (Programmable Key Pairs)
    // This would need additional setup with Lit Actions
    throw new Error('Signing via Lit Protocol requires PKP setup - use TEE or MPC provider');
  }

  // ========================================================================
  // Session Management
  // ========================================================================

  async createSession(
    authSig: AuthSignature,
    capabilities: string[],
    expirationHours: number = 24
  ): Promise<SessionKey> {
    const expiration = Date.now() + expirationHours * 60 * 60 * 1000;
    
    // Generate session public key
    const sessionId = this.generateKeyId();
    const publicKey = keccak256(toBytes(`session:${sessionId}:${authSig.address}:${expiration}`)) as Hex;

    return {
      publicKey,
      expiration,
      capabilities,
      authSig,
    };
  }

  validateSession(session: SessionKey): boolean {
    return session.expiration > Date.now();
  }

  // ========================================================================
  // Access Control Helpers
  // ========================================================================

  private policyToLitConditions(policy: AccessControlPolicy): LitAccessCondition[] {
    return policy.conditions.map((condition) => this.conditionToLit(condition));
  }

  private conditionToLit(condition: AccessCondition): LitAccessCondition {
    switch (condition.type) {
      case 'contract':
        return {
          contractAddress: condition.contractAddress,
          standardContractType: 'Custom',
          chain: condition.chain,
          method: condition.method,
          parameters: condition.parameters.map(String),
          returnValueTest: {
            comparator: condition.returnValueTest.comparator,
            value: condition.returnValueTest.value,
          },
        };

      case 'timestamp':
        return {
          contractAddress: '',
          standardContractType: 'timestamp',
          chain: condition.chain,
          method: 'eth_getBlockByNumber',
          parameters: ['latest'],
          returnValueTest: {
            comparator: condition.comparator,
            value: condition.value.toString(),
          },
        };

      case 'balance':
        return {
          contractAddress: condition.tokenAddress ?? '',
          standardContractType: condition.tokenAddress ? 'ERC20' : '',
          chain: condition.chain,
          method: 'balanceOf',
          parameters: [':userAddress'],
          returnValueTest: {
            comparator: condition.comparator,
            value: condition.value,
          },
        };

      case 'stake':
        return {
          contractAddress: condition.registryAddress,
          standardContractType: 'Custom',
          chain: condition.chain,
          method: 'getStakeUSD',
          parameters: [':userAddress'],
          returnValueTest: {
            comparator: ConditionOperator.GREATER_THAN_OR_EQUAL,
            value: (condition.minStakeUSD * 1e18).toString(),
          },
        };

      case 'role':
        return {
          contractAddress: condition.registryAddress,
          standardContractType: 'Custom',
          chain: condition.chain,
          method: 'hasRole',
          parameters: [condition.role, ':userAddress'],
          returnValueTest: {
            comparator: ConditionOperator.EQUALS,
            value: 'true',
          },
        };

      case 'agent':
        return {
          contractAddress: condition.registryAddress,
          standardContractType: 'Custom',
          chain: condition.chain,
          method: 'getAgentOwner',
          parameters: [condition.agentId.toString()],
          returnValueTest: {
            comparator: ConditionOperator.EQUALS,
            value: ':userAddress',
          },
        };
    }
  }

  private getChainFromPolicy(policy: AccessControlPolicy): string {
    // Extract chain from first condition
    const firstCondition = policy.conditions[0];
    if ('chain' in firstCondition) {
      return firstCondition.chain;
    }
    return 'base-sepolia'; // Default
  }

  // ========================================================================
  // Fallback Encryption (when Lit is unavailable)
  // ========================================================================

  private async fallbackEncrypt(data: string): Promise<{ ciphertext: string; iv: string; tag: string }> {
    const crypto = await import('crypto');
    const key = this.fallbackKey!.slice(0, 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  private async fallbackDecrypt(ciphertext: string, iv: string, tag: string): Promise<string> {
    const crypto = await import('crypto');
    const key = this.fallbackKey!.slice(0, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generateKeyId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `lit-${timestamp}-${random}`;
  }

  getStatus(): { connected: boolean; network: string; fallbackMode: boolean } {
    return {
      connected: this.client?.ready ?? false,
      network: this.config.network,
      fallbackMode: !this.client?.ready,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

let litProvider: LitProvider | null = null;

export function getLitProvider(config?: Partial<LitConfig>): LitProvider {
  if (!litProvider) {
    litProvider = new LitProvider({
      network: config?.network ?? (process.env.LIT_NETWORK as LitConfig['network']) ?? 'cayenne',
      debug: config?.debug ?? process.env.LIT_DEBUG === 'true',
    });
  }
  return litProvider;
}

