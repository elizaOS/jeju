/**
 * Gateway Session KMS Integration
 * 
 * STATUS: REFERENCE IMPLEMENTATION - Not wired into app entry point.
 * To use: Import getSessionManager() and call its methods.
 *
 * Uses @jeju/kms for encrypted session management with AES-256-GCM fallback.
 */

import {
  getKMS,
  type EncryptedPayload,
  type AccessControlPolicy,
  ConditionOperator,
} from '@jeju/kms';
import type { Address, Hex } from 'viem';

// ============================================================================
// Session Types
// ============================================================================

export interface GatewaySession {
  sessionId: string;
  userAddress: Address;
  createdAt: number;
  expiresAt: number;
  permissions: SessionPermission[];
  metadata?: Record<string, string>;
}

export type SessionPermission = 'bridge' | 'stake' | 'provide_liquidity' | 'deploy_paymaster' | 'admin';

export interface EncryptedSession {
  encryptedData: EncryptedPayload;
  sessionId: string;
  expiresAt: number;
}

// ============================================================================
// Session Manager
// ============================================================================

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_NAMESPACE = 'gateway-session';

export class SessionManager {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const kms = getKMS();
    await kms.initialize();
    this.initialized = true;
    console.log('[SessionManager] Initialized');
  }

  /**
   * Create an encrypted session for a user
   */
  async createSession(
    userAddress: Address,
    permissions: SessionPermission[] = ['bridge', 'stake']
  ): Promise<EncryptedSession> {
    await this.ensureInitialized();

    const sessionId = this.generateSessionId();
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;

    const session: GatewaySession = {
      sessionId,
      userAddress,
      createdAt: now,
      expiresAt,
      permissions,
    };

    // Only the user can decrypt their session
    const policy: AccessControlPolicy = {
      conditions: [
        {
          type: 'balance',
          chain: process.env.CHAIN_ID ?? 'base-sepolia',
          comparator: ConditionOperator.GREATER_THAN_OR_EQUAL,
          value: '0',
        },
      ],
      operator: 'and',
    };

    const kms = getKMS();
    const encrypted = await kms.encrypt({
      data: JSON.stringify(session),
      policy,
      metadata: {
        type: SESSION_NAMESPACE,
        sessionId,
        userAddress,
      },
    });

    return {
      encryptedData: encrypted,
      sessionId,
      expiresAt,
    };
  }

  /**
   * Decrypt and validate a session
   */
  async validateSession(
    encryptedSession: EncryptedSession,
    authSig?: {
      sig: Hex;
      derivedVia: 'web3.eth.personal.sign' | 'EIP712' | 'siwe';
      signedMessage: string;
      address: Address;
    }
  ): Promise<{ valid: boolean; session?: GatewaySession; error?: string }> {
    await this.ensureInitialized();

    // Check expiry first
    if (Date.now() > encryptedSession.expiresAt) {
      return { valid: false, error: 'Session expired' };
    }

    const kms = getKMS();
    const decrypted = await kms.decrypt({
      payload: encryptedSession.encryptedData,
      authSig,
    });

    const session = JSON.parse(decrypted) as GatewaySession;

    // Verify session matches
    if (session.sessionId !== encryptedSession.sessionId) {
      return { valid: false, error: 'Session ID mismatch' };
    }

    // Verify not expired (double check)
    if (Date.now() > session.expiresAt) {
      return { valid: false, error: 'Session expired' };
    }

    return { valid: true, session };
  }

  /**
   * Check if a session has a specific permission
   */
  async hasPermission(
    encryptedSession: EncryptedSession,
    permission: SessionPermission,
    authSig?: {
      sig: Hex;
      derivedVia: 'web3.eth.personal.sign' | 'EIP712' | 'siwe';
      signedMessage: string;
      address: Address;
    }
  ): Promise<boolean> {
    const result = await this.validateSession(encryptedSession, authSig);
    if (!result.valid || !result.session) return false;
    return result.session.permissions.includes(permission);
  }

  /**
   * Extend a session's expiry
   */
  async extendSession(
    encryptedSession: EncryptedSession,
    extensionMs: number = SESSION_TTL_MS,
    authSig?: {
      sig: Hex;
      derivedVia: 'web3.eth.personal.sign' | 'EIP712' | 'siwe';
      signedMessage: string;
      address: Address;
    }
  ): Promise<EncryptedSession> {
    const result = await this.validateSession(encryptedSession, authSig);
    if (!result.valid || !result.session) {
      throw new Error(result.error ?? 'Invalid session');
    }

    // Create new session with extended expiry
    const newSession: GatewaySession = {
      ...result.session,
      expiresAt: Date.now() + extensionMs,
    };

    const policy: AccessControlPolicy = {
      conditions: [
        {
          type: 'balance',
          chain: process.env.CHAIN_ID ?? 'base-sepolia',
          comparator: ConditionOperator.GREATER_THAN_OR_EQUAL,
          value: '0',
        },
      ],
      operator: 'and',
    };

    const kms = getKMS();
    const encrypted = await kms.encrypt({
      data: JSON.stringify(newSession),
      policy,
      metadata: {
        type: SESSION_NAMESPACE,
        sessionId: newSession.sessionId,
        userAddress: newSession.userAddress,
      },
    });

    return {
      encryptedData: encrypted,
      sessionId: newSession.sessionId,
      expiresAt: newSession.expiresAt,
    };
  }

  private generateSessionId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let sessionManager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager();
  }
  return sessionManager;
}

export function resetSessionManager(): void {
  sessionManager = null;
}

