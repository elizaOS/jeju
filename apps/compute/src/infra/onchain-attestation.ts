/**
 * On-Chain TEE Attestation
 *
 * Based on the architecture from:
 * - Atoma Network paper: https://arxiv.org/html/2410.13752
 * - Automata's on-chain PCCS
 *
 * This is the TRULY PERMISSIONLESS approach:
 * 1. TEE generates keypair inside enclave
 * 2. Attestation is published on-chain
 * 3. Anyone can verify via smart contract
 * 4. NO API KEYS, NO DASHBOARD - just wallet + smart contract
 */

import type { Address, Hex, PublicClient, WalletClient } from 'viem';
import { keccak256, toBytes } from 'viem';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TEEAttestation {
  /** The measurement/hash of the code running in the TEE */
  mrEnclave: Hex;
  /** The public key derived inside the TEE */
  publicKey: Hex;
  /** The TEE operator address (derived from public key) */
  operatorAddress: Address;
  /** The raw attestation quote from hardware */
  quote: Hex;
  /** Timestamp of attestation */
  timestamp: number;
  /** TEE platform (intel-sgx, intel-tdx, amd-sev, aws-nitro) */
  platform: 'intel-sgx' | 'intel-tdx' | 'amd-sev' | 'aws-nitro' | 'simulated';
}

export interface OnChainRegistration {
  /** Transaction hash of registration */
  txHash: Hex;
  /** Block number */
  blockNumber: bigint;
  /** The registered operator address */
  operatorAddress: Address;
  /** Whether registration was successful */
  success: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// ON-CHAIN ATTESTATION VERIFIER CONTRACT ABI
// Based on Automata's DCAP attestation verification
// ═══════════════════════════════════════════════════════════════════════════

export const ATTESTATION_VERIFIER_ABI = [
  {
    name: 'registerOperator',
    type: 'function',
    inputs: [
      { name: 'operatorAddress', type: 'address' },
      { name: 'mrEnclave', type: 'bytes32' },
      { name: 'attestationQuote', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'verifyAttestation',
    type: 'function',
    inputs: [
      { name: 'operatorAddress', type: 'address' },
      { name: 'expectedMrEnclave', type: 'bytes32' },
    ],
    outputs: [
      { name: 'valid', type: 'bool' },
      { name: 'timestamp', type: 'uint256' },
    ],
  },
  {
    name: 'getOperatorAttestation',
    type: 'function',
    inputs: [{ name: 'operatorAddress', type: 'address' }],
    outputs: [
      { name: 'mrEnclave', type: 'bytes32' },
      { name: 'publicKey', type: 'bytes' },
      { name: 'attestationQuote', type: 'bytes' },
      { name: 'registeredAt', type: 'uint256' },
      { name: 'lastHeartbeat', type: 'uint256' },
    ],
  },
  {
    name: 'heartbeat',
    type: 'function',
    inputs: [],
    outputs: [],
  },
  {
    name: 'OperatorRegistered',
    type: 'event',
    inputs: [
      { name: 'operator', type: 'address', indexed: true },
      { name: 'mrEnclave', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// ON-CHAIN ATTESTATION CLIENT
// ═══════════════════════════════════════════════════════════════════════════

export class OnChainAttestationClient {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null;
  private contractAddress: Address;

  constructor(
    publicClient: PublicClient,
    contractAddress: Address,
    walletClient?: WalletClient
  ) {
    this.publicClient = publicClient;
    this.contractAddress = contractAddress;
    this.walletClient = walletClient ?? null;
  }

  /**
   * Register a TEE operator on-chain
   *
   * This is the PERMISSIONLESS registration:
   * - Anyone can call this with a valid attestation
   * - Smart contract verifies the attestation
   * - No API key or dashboard needed
   */
  async registerOperator(
    attestation: TEEAttestation
  ): Promise<OnChainRegistration> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for registration');
    }

    console.log('[OnChain] Registering operator on-chain...');
    console.log(`[OnChain] Operator: ${attestation.operatorAddress}`);
    console.log(`[OnChain] MrEnclave: ${attestation.mrEnclave}`);
    console.log(`[OnChain] Platform: ${attestation.platform}`);

    // Simulate first to check if it will succeed
    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: ATTESTATION_VERIFIER_ABI,
      functionName: 'registerOperator',
      args: [
        attestation.operatorAddress,
        attestation.mrEnclave as `0x${string}`,
        attestation.quote as `0x${string}`,
      ],
      account: this.walletClient.account,
    });

    // Execute the transaction
    const txHash = await this.walletClient.writeContract(request);

    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    console.log(`[OnChain] ✅ Registered in block ${receipt.blockNumber}`);
    console.log(`[OnChain] TX: ${txHash}`);

    return {
      txHash,
      blockNumber: receipt.blockNumber,
      operatorAddress: attestation.operatorAddress,
      success: receipt.status === 'success',
    };
  }

  /**
   * Verify a TEE operator's attestation on-chain
   *
   * Anyone can call this to verify:
   * - The operator is registered
   * - The attestation is valid
   * - The code hash matches expected
   */
  async verifyOperator(
    operatorAddress: Address,
    expectedMrEnclave: Hex
  ): Promise<{ valid: boolean; registeredAt: bigint }> {
    const result = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ATTESTATION_VERIFIER_ABI,
      functionName: 'verifyAttestation',
      args: [operatorAddress, expectedMrEnclave as `0x${string}`],
    })) as readonly [boolean, bigint];

    return {
      valid: result[0],
      registeredAt: result[1],
    };
  }

  /**
   * Get the full attestation for an operator
   */
  async getOperatorAttestation(operatorAddress: Address): Promise<{
    mrEnclave: Hex;
    publicKey: Hex;
    attestationQuote: Hex;
    registeredAt: bigint;
    lastHeartbeat: bigint;
  } | null> {
    try {
      const result = (await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ATTESTATION_VERIFIER_ABI,
        functionName: 'getOperatorAttestation',
        args: [operatorAddress],
      })) as readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        bigint,
      ];

      const [
        mrEnclave,
        publicKey,
        attestationQuote,
        registeredAt,
        lastHeartbeat,
      ] = result;

      return {
        mrEnclave: mrEnclave as Hex,
        publicKey: publicKey as Hex,
        attestationQuote: attestationQuote as Hex,
        registeredAt,
        lastHeartbeat,
      };
    } catch {
      return null;
    }
  }

  /**
   * Send a heartbeat to prove the TEE is still alive
   */
  async heartbeat(): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for heartbeat');
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: ATTESTATION_VERIFIER_ABI,
      functionName: 'heartbeat',
      account: this.walletClient.account,
    });

    return this.walletClient.writeContract(request);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTESTATION HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a simulated attestation for testing
 * In production, this would come from real TEE hardware
 */
export function generateSimulatedAttestation(
  codeHash: Hex,
  operatorAddress: Address
): TEEAttestation {
  const publicKey = keccak256(toBytes(`pubkey:${operatorAddress}`));
  const quote = keccak256(
    toBytes(`quote:${codeHash}:${operatorAddress}:${Date.now()}`)
  );

  return {
    mrEnclave: codeHash,
    publicKey: publicKey as Hex,
    operatorAddress,
    quote: quote as Hex,
    timestamp: Date.now(),
    platform: 'simulated',
  };
}

/**
 * Verify an attestation quote locally (for quick checks)
 * In production, this should be done on-chain
 */
export function verifyAttestationLocally(
  attestation: TEEAttestation,
  expectedMrEnclave: Hex
): { valid: boolean; reason: string } {
  if (attestation.mrEnclave !== expectedMrEnclave) {
    return {
      valid: false,
      reason: `MrEnclave mismatch: expected ${expectedMrEnclave}, got ${attestation.mrEnclave}`,
    };
  }

  if (attestation.platform === 'simulated') {
    return {
      valid: true,
      reason: 'Simulated attestation (not hardware-verified)',
    };
  }

  // For real hardware, verify the quote structure
  // This is a simplified check - real verification needs Intel/AMD libraries
  if (!attestation.quote || attestation.quote.length < 100) {
    return {
      valid: false,
      reason: 'Invalid quote format',
    };
  }

  return {
    valid: true,
    reason: 'Attestation verified',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  OnChainAttestationClient as AttestationClient,
  ATTESTATION_VERIFIER_ABI as AttestationABI,
};
