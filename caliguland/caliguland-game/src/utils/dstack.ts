/**
 * Dstack TEE Integration Utilities
 */

// Type stub for DStack SDK - update when SDK types are available
type DstackSDKType = any;
let DstackSDK: any;
try {
  const dstackModule = require('@phala/dstack-sdk');
  DstackSDK = dstackModule.DstackSDK || dstackModule.default || dstackModule;
} catch {
  // Fallback for development without TEE
  DstackSDK = class {
    async deriveKey() { return { key: 'mock-key' }; }
    async getInfo() { return { version: 'mock' }; }
    async getQuote() { return { quote: 'mock-quote' }; }
  };
}

export class DstackHelper {
  private sdk: any;
  private keyCache: Map<string, string>;

  constructor() {
    this.sdk = new DstackSDK();
    this.keyCache = new Map();
  }

  /**
   * Derive a deterministic key from a path
   */
  async deriveKey(path: string): Promise<string> {
    if (this.keyCache.has(path)) {
      return this.keyCache.get(path)!;
    }

    try {
      const response = await this.sdk.deriveKey(path);
      this.keyCache.set(path, response.key);
      return response.key;
    } catch (error) {
      console.error(`Failed to derive key for path: ${path}`, error);
      throw error;
    }
  }

  /**
   * Get TEE instance information
   */
  async getInfo() {
    try {
      return await this.sdk.getInfo();
    } catch (error) {
      console.error('Failed to get TEE info:', error);
      throw error;
    }
  }

  /**
   * Generate a quote for attestation
   */
  async getQuote(reportData: string | object) {
    try {
      const data = typeof reportData === 'string' 
        ? reportData 
        : JSON.stringify(reportData);
      
      return await this.sdk.getQuote(data);
    } catch (error) {
      console.error('Failed to generate quote:', error);
      throw error;
    }
  }

  /**
   * Create a commitment hash for an outcome
   */
  createCommitment(outcome: string, salt: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(`${outcome}${salt}`)
      .digest('hex');
  }

  /**
   * Verify a commitment
   */
  verifyCommitment(outcome: string, salt: string, commitment: string): boolean {
    const computed = this.createCommitment(outcome, salt);
    return computed === commitment;
  }
}

export const dstackHelper = new DstackHelper();

