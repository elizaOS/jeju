/**
 * Compute Marketplace Types
 *
 * Types for the Jeju decentralized AI compute marketplace.
 */

// ============================================================================
// Provider Types
// ============================================================================

export interface ComputeProvider {
  address: string;
  name: string;
  endpoint: string;
  attestationHash: string;
  stake: bigint;
  registeredAt: number;
  agentId: number;
  active: boolean;
}

export interface ComputeCapability {
  model: string;
  pricePerInputToken: bigint;
  pricePerOutputToken: bigint;
  maxContextLength: number;
  active: boolean;
}

// ============================================================================
// Ledger Types
// ============================================================================

export interface ComputeLedger {
  totalBalance: bigint;
  availableBalance: bigint;
  lockedBalance: bigint;
  createdAt: number;
}

export interface ProviderSubAccount {
  balance: bigint;
  pendingRefund: bigint;
  refundUnlockTime: number;
  acknowledged: boolean;
}

// ============================================================================
// Inference Types
// ============================================================================

export interface InferenceService {
  provider: string;
  model: string;
  endpoint: string;
  pricePerInputToken: bigint;
  pricePerOutputToken: bigint;
  active: boolean;
}

export interface InferenceSettlement {
  user: string;
  provider: string;
  requestHash: string;
  inputTokens: number;
  outputTokens: number;
  fee: bigint;
  timestamp: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InferenceRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  seed?: number;
}

export interface InferenceResponse {
  id: string;
  model: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  settlement?: {
    provider: string;
    requestHash: string;
    inputTokens: number;
    outputTokens: number;
    nonce: number;
    signature: string;
  };
}

// ============================================================================
// Staking Types
// ============================================================================

export enum ComputeStakeType {
  NONE = 0,
  USER = 1,
  PROVIDER = 2,
  GUARDIAN = 3,
}

export interface ComputeStake {
  amount: bigint;
  stakeType: ComputeStakeType;
  stakedAt: number;
  lockedUntil: number;
  slashed: boolean;
}

// ============================================================================
// Hardware Types
// ============================================================================

export type Platform = 'darwin' | 'linux' | 'win32';
export type Architecture = 'arm64' | 'x64';

export interface HardwareInfo {
  platform: Platform;
  arch: Architecture;
  cpus: number;
  memory: number;
  gpuType: string | null;
  gpuVram: number | null;
  cudaVersion: string | null;
  mlxVersion: string | null;
}

export interface AttestationReport {
  signingAddress: string;
  hardware: HardwareInfo;
  timestamp: string;
  nonce: string;
  signature: string;
  simulated: boolean;
}

// ============================================================================
// SDK Configuration Types
// ============================================================================

export interface ComputeSDKConfig {
  rpcUrl: string;
  privateKey?: string;
  contracts: {
    registry: string;
    ledger: string;
    inference: string;
  };
}

export interface ModerationSDKConfig {
  rpcUrl: string;
  privateKey?: string;
  contracts: {
    staking: string;
    banManager: string;
  };
}

// ============================================================================
// Auth Types
// ============================================================================

export interface ComputeAuthHeaders {
  'x-jeju-address': string;
  'x-jeju-nonce': string;
  'x-jeju-signature': string;
  'x-jeju-timestamp': string;
}

// ============================================================================
// Node Configuration Types
// ============================================================================

export interface ComputeNodeConfig {
  privateKey: string;
  registryAddress: string;
  ledgerAddress: string;
  inferenceAddress: string;
  rpcUrl: string;
  port: number;
  models: ModelConfig[];
}

export interface ModelConfig {
  name: string;
  backend: 'ollama' | 'llamacpp' | 'mock';
  endpoint?: string;
  pricePerInputToken: bigint;
  pricePerOutputToken: bigint;
  maxContextLength: number;
}

// ============================================================================
// Network Types
// ============================================================================

export interface ComputeNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
}

export interface ComputeDeployment {
  network: string;
  chainId: number;
  deployer: string;
  contracts: {
    registry: string;
    ledger: string;
    inference: string;
    staking: string;
    banManager: string;
  };
  timestamp: string;
}

