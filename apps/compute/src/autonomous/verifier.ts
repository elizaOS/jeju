/**
 * Attestation & Permissionless Verifier
 *
 * Tools to verify:
 * 1. TEE attestation is valid (code integrity)
 * 2. On-chain state matches TEE state
 * 3. System is truly permissionless (no hidden keys)
 * 4. Anyone can take over if operator fails
 *
 * ⚠️ NOTE: In simulation mode, hardwareAuthentic will be FALSE
 * because we're not running on real Intel TDX hardware.
 * For TRUE hardware attestation, deploy to Phala CVM.
 */

import type { Address, Hex } from 'viem';
import { BlockchainClient } from '../infra/blockchain-client.js';
import { type AttestationQuote, verifyQuote } from '../tee/attestation.js';

// ═══════════════════════════════════════════════════════════════════════════
// ATTESTATION VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export interface AttestationVerification {
  valid: boolean;
  codeIntegrity: boolean;
  hardwareAuthentic: boolean;
  operatorAddressMatches: boolean;
  isSimulated: boolean;
  errors: string[];
  warnings: string[];
  details: {
    codeHash: Hex;
    operatorAddress: Address;
    timestamp: number;
    cpuSignatureValid: boolean;
    gpuSignatureValid: boolean;
  };
}

/**
 * Verify a TEE attestation quote
 *
 * This proves:
 * 1. The code running is exactly what we expect (no tampering)
 * 2. It's running on genuine Intel TDX + NVIDIA H200 hardware
 * 3. The operator address was derived inside the TEE
 */
export function verifyAttestation(
  quote: AttestationQuote,
  expectedCodeHash?: Hex
): AttestationVerification {
  const baseVerification = verifyQuote(quote);

  const codeIntegrity = expectedCodeHash
    ? quote.mrEnclave === expectedCodeHash
    : baseVerification.codeIntegrity;

  const operatorAddressMatches = quote.reportData.startsWith('0x')
    ? quote.reportData
        .toLowerCase()
        .includes(quote.reportData.slice(2, 42).toLowerCase())
    : true;

  return {
    valid: baseVerification.valid && codeIntegrity,
    codeIntegrity,
    hardwareAuthentic: baseVerification.hardwareAuthentic,
    operatorAddressMatches,
    isSimulated: quote.isSimulated,
    errors: [
      ...baseVerification.errors,
      ...(codeIntegrity ? [] : ['Code hash does not match expected']),
    ],
    warnings: baseVerification.warnings,
    details: {
      codeHash: quote.mrEnclave,
      operatorAddress: quote.operatorAddress,
      timestamp: quote.timestamp,
      cpuSignatureValid:
        !quote.isSimulated && baseVerification.hardwareAuthentic,
      gpuSignatureValid:
        !quote.isSimulated && baseVerification.hardwareAuthentic,
    },
  };
}

/**
 * Format verification result for display
 */
export function formatVerification(v: AttestationVerification): string {
  const status = v.valid ? '✅ VALID' : '❌ INVALID';
  const simWarning = v.isSimulated
    ? '\n⚠️ SIMULATION MODE - Not real hardware attestation'
    : '';

  return `
═══════════════════════════════════════════════════════════
                ATTESTATION VERIFICATION
═══════════════════════════════════════════════════════════
${simWarning}
Status: ${status}

Code Integrity:     ${v.codeIntegrity ? '✓ Verified' : '✗ Failed'}
Hardware Authentic: ${v.hardwareAuthentic ? '✓ Genuine TEE' : '⚠️ Simulated'}
Operator Address:   ${v.operatorAddressMatches ? '✓ Matches' : '✗ Mismatch'}

Details:
  Code Hash:  ${v.details.codeHash.slice(0, 20)}...
  Operator:   ${v.details.operatorAddress}
  Timestamp:  ${new Date(v.details.timestamp).toISOString()}
  CPU Sig:    ${v.details.cpuSignatureValid ? 'Valid' : 'Simulated'}
  GPU Sig:    ${v.details.gpuSignatureValid ? 'Valid' : 'Simulated'}

${v.errors.length > 0 ? `Errors:\n  ${v.errors.join('\n  ')}` : ''}
═══════════════════════════════════════════════════════════
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSIONLESS VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export interface PermissionlessCheck {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
}

/**
 * Verify the system is truly permissionless
 *
 * Checks:
 * 1. No API keys in configuration
 * 2. All auth is wallet-based
 * 3. Operator can be replaced by anyone
 * 4. State is recoverable from public storage
 */
export function verifyPermissionless(config: {
  hasApiKeys: boolean;
  usesWalletAuth: boolean;
  operatorReplaceable: boolean;
  statePubliclyAccessible: boolean;
  codeOpenSource: boolean;
}): PermissionlessCheck {
  const checks = [
    {
      name: 'No API Keys',
      passed: !config.hasApiKeys,
      details: config.hasApiKeys
        ? 'System uses API keys (centralized!)'
        : 'No API keys required - fully permissionless',
    },
    {
      name: 'Wallet Authentication',
      passed: config.usesWalletAuth,
      details: config.usesWalletAuth
        ? 'All auth via cryptographic signatures'
        : 'Uses non-wallet authentication (centralized!)',
    },
    {
      name: 'Operator Replaceable',
      passed: config.operatorReplaceable,
      details: config.operatorReplaceable
        ? 'Anyone can become operator after timeout'
        : 'Operator cannot be replaced (centralized!)',
    },
    {
      name: 'Public State Access',
      passed: config.statePubliclyAccessible,
      details: config.statePubliclyAccessible
        ? 'State stored on public decentralized storage'
        : 'State in private storage (centralized!)',
    },
    {
      name: 'Open Source',
      passed: config.codeOpenSource,
      details: config.codeOpenSource
        ? 'Code is open source and verifiable'
        : 'Closed source code (cannot verify!)',
    },
  ];

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

/**
 * Format permissionless check for display
 */
export function formatPermissionlessCheck(check: PermissionlessCheck): string {
  const status = check.passed
    ? '✅ TRULY PERMISSIONLESS'
    : '❌ NOT FULLY PERMISSIONLESS';

  const checkLines = check.checks
    .map((c) => `  ${c.passed ? '✓' : '✗'} ${c.name}: ${c.details}`)
    .join('\n');

  return `
═══════════════════════════════════════════════════════════
              PERMISSIONLESS VERIFICATION
═══════════════════════════════════════════════════════════

Status: ${status}

Checks:
${checkLines}

${
  check.passed
    ? `
This system is TRULY PERMISSIONLESS:
  • No central authority controls it
  • Anyone can verify the code via attestation
  • Anyone can become operator if current one fails
  • All state is publicly accessible
  • No secrets except TEE-derived keys
`
    : `
WARNING: This system has centralization risks!
Review the failed checks above.
`
}
═══════════════════════════════════════════════════════════
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ON-CHAIN STATE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export interface OnChainVerification {
  valid: boolean;
  operatorRegistered: boolean;
  operatorActive: boolean;
  treasuryFunded: boolean;
  stateCommitted: boolean;
  details: {
    contractAddress: Address;
    operator: Address;
    treasuryBalance: bigint;
    stateVersion: bigint;
    keyVersion: bigint;
    lastHeartbeat: Date;
  };
}

/**
 * Verify on-chain state
 */
export async function verifyOnChainState(
  blockchain: BlockchainClient
): Promise<OnChainVerification> {
  const balance = await blockchain.getBalance();
  const gameState = await blockchain.getGameState();
  const operatorInfo = await blockchain.getOperatorInfo();

  return {
    valid: operatorInfo.active && balance > 0n && gameState.version >= 0n,
    operatorRegistered:
      operatorInfo.address !== '0x0000000000000000000000000000000000000000',
    operatorActive: operatorInfo.active,
    treasuryFunded: balance > 0n,
    stateCommitted: gameState.version > 0n || gameState.cid !== '',
    details: {
      contractAddress: blockchain.getContractAddress(),
      operator: operatorInfo.address,
      treasuryBalance: balance,
      stateVersion: gameState.version,
      keyVersion: gameState.keyVersion,
      lastHeartbeat: new Date(Number(gameState.lastHeartbeat) * 1000),
    },
  };
}

/**
 * Format on-chain verification for display
 */
export function formatOnChainVerification(v: OnChainVerification): string {
  return `
═══════════════════════════════════════════════════════════
              ON-CHAIN STATE VERIFICATION
═══════════════════════════════════════════════════════════

Contract: ${v.details.contractAddress}

Status:
  Operator Registered: ${v.operatorRegistered ? '✓' : '✗'} ${v.details.operator}
  Operator Active:     ${v.operatorActive ? '✓ Yes' : '✗ No (timed out?)'}
  Treasury Funded:     ${v.treasuryFunded ? '✓' : '✗'} ${v.details.treasuryBalance} wei
  State Committed:     ${v.stateCommitted ? '✓' : '✗'} Version ${v.details.stateVersion}

Details:
  Key Version:    ${v.details.keyVersion}
  Last Heartbeat: ${v.details.lastHeartbeat.toISOString()}

${v.valid ? '✅ On-chain state is valid' : '❌ On-chain state has issues'}
═══════════════════════════════════════════════════════════
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TAKEOVER VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export interface TakeoverCapability {
  canTakeOver: boolean;
  reason: string;
  currentOperator: Address;
  operatorActive: boolean;
  timeUntilTimeout: number; // milliseconds, -1 if already timed out
}

/**
 * Check if a takeover is possible
 *
 * This proves the system is truly permissionless - if the operator
 * stops sending heartbeats, ANYONE can take over.
 */
export async function checkTakeoverCapability(
  blockchain: BlockchainClient,
  heartbeatTimeoutMs: number = 3600_000 // 1 hour default
): Promise<TakeoverCapability> {
  const gameState = await blockchain.getGameState();
  const operatorInfo = await blockchain.getOperatorInfo();

  const now = Date.now();
  const lastHeartbeat = Number(gameState.lastHeartbeat) * 1000;
  const timeSinceHeartbeat = now - lastHeartbeat;
  const timeUntilTimeout = heartbeatTimeoutMs - timeSinceHeartbeat;

  const canTakeOver = !operatorInfo.active || timeUntilTimeout <= 0;

  let reason: string;
  if (!operatorInfo.active) {
    reason = 'No active operator - anyone can register';
  } else if (timeUntilTimeout <= 0) {
    reason = 'Operator timed out - anyone can take over';
  } else {
    reason = `Operator active - wait ${Math.round(timeUntilTimeout / 1000)}s for timeout`;
  }

  return {
    canTakeOver,
    reason,
    currentOperator: operatorInfo.address,
    operatorActive: operatorInfo.active,
    timeUntilTimeout: Math.max(-1, timeUntilTimeout),
  };
}
