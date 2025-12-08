/**
 * DStack Integration (Phala TEE SDK)
 *
 * Phala Network provides Intel TDX-based TEE compute through dstack.
 * 
 * Features:
 * - Hardware-derived cryptographic keys
 * - Remote attestation (Intel TDX quotes)
 * - Sealed storage (encrypted with hardware keys)
 * - ERC-8004 agent identity integration
 *
 * This module provides:
 * 1. Running inside Phala TEE deployments
 * 2. Hardware-derived key derivation
 * 3. Production enclave abstraction
 * 4. Gateway integration for node discovery
 */

// NOTE: These imports will work when running inside Phala TEE
// Outside TEE, they'll fail - which is correct behavior
// import { TappdClient } from '@phala/dstack-sdk';

import type { Address, Hex } from 'viem';
import { keccak256, toBytes, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * DStack client for Phala TEE operations
 *
 * When running inside Phala CVM:
 * - Keys are derived from hardware (never exposed)
 * - Attestation is real Intel TDX
 * - All crypto operations happen in secure enclave
 */
export class DStackClient {
  private endpoint: string;
  private isInTEE: boolean;

  constructor(endpoint: string = 'http://localhost:8090') {
    this.endpoint = endpoint;
    this.isInTEE = this.detectTEEEnvironment();
  }

  /**
   * Detect if we're running inside a TEE
   */
  private detectTEEEnvironment(): boolean {
    // In real Phala CVM, the DStack simulator runs on localhost:8090
    // This is only accessible from inside the TEE
    return process.env.DSTACK_SIMULATOR_ENDPOINT !== undefined;
  }

  /**
   * Derive a deterministic key from the TEE's hardware root
   *
   * CRITICAL: This is what makes it permissionless!
   * - Key is derived from hardware, not provided by user
   * - Same code + same hardware = same key
   * - Key never leaves the TEE
   */
  async deriveKey(path: string, subject: string): Promise<Uint8Array> {
    if (!this.isInTEE) {
      // Simulation mode - use deterministic derivation
      console.warn('[DStack] Not in TEE - using simulated key derivation');
      const seed = keccak256(toBytes(`${path}:${subject}`));
      return toBytes(seed);
    }

    // Real DStack call
    const response = await fetch(`${this.endpoint}/prpc/Tappd.DeriveKey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, subject }),
    });

    if (!response.ok) {
      throw new Error(`DStack deriveKey failed: ${response.statusText}`);
    }

    const result = (await response.json()) as { asUint8Array: number[] };
    return new Uint8Array(result.asUint8Array);
  }

  /**
   * Get an Ethereum wallet derived from TEE hardware
   *
   * This is THE key feature:
   * - Wallet private key exists only inside TEE
   * - Same code deployed = same wallet address
   * - Attestation proves this specific code controls this wallet
   */
  async getWallet(): Promise<{ address: Address; privateKey: Hex }> {
    const keyBytes = await this.deriveKey(
      '/jeju/compute/v1',
      'ethereum-wallet'
    );
    const privateKey = toHex(keyBytes) as Hex;
    const account = privateKeyToAccount(privateKey);

    return {
      address: account.address,
      privateKey,
    };
  }

  /**
   * Generate a remote attestation quote
   *
   * This proves:
   * 1. Code running is exactly what we claim (hash match)
   * 2. Running on real Intel TDX hardware
   * 3. TEE is in valid state
   */
  async generateAttestation(reportData: Hex): Promise<{
    quote: Hex;
    eventLog: string;
  }> {
    if (!this.isInTEE) {
      console.warn('[DStack] Not in TEE - using simulated attestation');
      return {
        quote: keccak256(toBytes(`simulated:${reportData}`)) as Hex,
        eventLog: JSON.stringify({ simulated: true, reportData }),
      };
    }

    const response = await fetch(`${this.endpoint}/prpc/Tappd.TdxQuote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_data: reportData,
      }),
    });

    if (!response.ok) {
      throw new Error(`DStack attestation failed: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      quote: string;
      event_log: string;
    };
    return {
      quote: result.quote as Hex,
      eventLog: result.event_log,
    };
  }

  /**
   * Encrypt data that can only be decrypted by this TEE
   */
  async seal(data: Uint8Array): Promise<Uint8Array> {
    const key = await this.deriveKey('/jeju/compute/v1', 'sealing-key');

    // Use the derived key for AES-GCM encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key.slice(0, 32),
      'AES-GCM',
      false,
      ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data as Uint8Array<ArrayBuffer>
    );

    // Prepend IV to ciphertext
    const result = new Uint8Array(iv.length + ciphertext.byteLength);
    result.set(iv);
    result.set(new Uint8Array(ciphertext), iv.length);

    return result;
  }

  /**
   * Decrypt data sealed by this TEE
   */
  async unseal(sealed: Uint8Array): Promise<Uint8Array> {
    const key = await this.deriveKey('/jeju/compute/v1', 'sealing-key');

    const iv = sealed.slice(0, 12);
    const ciphertext = sealed.slice(12);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key.slice(0, 32),
      'AES-GCM',
      false,
      ['decrypt']
    );

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext as Uint8Array<ArrayBuffer>
    );

    return new Uint8Array(plaintext);
  }

  /**
   * Check if running in real TEE
   */
  isRunningInTEE(): boolean {
    return this.isInTEE;
  }
}

/**
 * Production TEE Enclave using real DStack
 *
 * This replaces the simulated TEEEnclave for production.
 */
export class ProductionTEEEnclave {
  private dstack: DStackClient;
  private wallet: { address: Address; privateKey: Hex } | null = null;
  private attestation: { quote: Hex; eventLog: string } | null = null;

  private constructor() {
    this.dstack = new DStackClient();
  }

  static async create(): Promise<ProductionTEEEnclave> {
    const enclave = new ProductionTEEEnclave();
    await enclave.initialize();
    return enclave;
  }

  private async initialize(): Promise<void> {
    // Derive wallet from hardware
    this.wallet = await this.dstack.getWallet();

    // Generate attestation proving this code controls this wallet
    this.attestation = await this.dstack.generateAttestation(
      this.wallet.address as Hex
    );

    console.log('[TEE] Initialized');
    console.log(`[TEE] Address: ${this.wallet.address}`);
    console.log(`[TEE] In real TEE: ${this.dstack.isRunningInTEE()}`);
  }

  getAddress(): Address {
    if (!this.wallet) throw new Error('Not initialized');
    return this.wallet.address;
  }

  getAttestation(): { quote: Hex; eventLog: string } {
    if (!this.attestation) throw new Error('Not initialized');
    return this.attestation;
  }

  async sealState(state: object): Promise<Uint8Array> {
    const json = JSON.stringify(state);
    const bytes = new TextEncoder().encode(json);
    return this.dstack.seal(bytes);
  }

  async unsealState<T>(sealed: Uint8Array): Promise<T> {
    const bytes = await this.dstack.unseal(sealed);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  }

  isInRealTEE(): boolean {
    return this.dstack.isRunningInTEE();
  }
}

/**
 * Dockerfile for Phala deployment
 */
export const DOCKERFILE = `
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
RUN npm install

# Copy source
COPY . .

# Build
RUN npm run build

# DStack expects the app to listen on 8080
EXPOSE 8080

# Start the game
CMD ["node", "dist/infra/production-entrypoint.js"]
`;

/**
 * Production entrypoint that uses real DStack
 */
export const PRODUCTION_ENTRYPOINT = `
import { ProductionTEEEnclave } from './dstack-integration.js';
import { BlockchainClient } from './blockchain-client.js';
import { ArweaveStorage } from '../storage/arweave-storage.js';

async function main() {
  console.log('=== PERMISSIONLESS AI GAME ===');

  // 1. Initialize TEE (derives keys from hardware)
  const tee = await ProductionTEEEnclave.create();
  console.log('TEE Address:', tee.getAddress());
  console.log('Running in real TEE:', tee.isInRealTEE());

  // 2. Connect to blockchain
  const blockchain = new BlockchainClient({
    chainId: process.env.CHAIN_ID as 'mainnet' | 'sepolia',
    rpcUrl: process.env.RPC_URL,
    contractAddress: process.env.CONTRACT_ADDRESS as \`0x\${string}\`,
    // NOTE: Private key comes from TEE, not environment!
  });

  // 3. Register as operator (if not already)
  const attestation = tee.getAttestation();
  // ... register on-chain with attestation

  // 4. Run game loop
  while (true) {
    // - Process game actions
    // - Run training
    // - Save state to Arweave
    // - Update on-chain
    // - Send heartbeat
    await new Promise(r => setTimeout(r, 60000));
  }
}

main().catch(console.error);
`;
