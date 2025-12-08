/**
 * SDK Types for Babylon Compute Marketplace
 */

import type { Wallet } from 'ethers';

export interface SDKConfig {
  rpcUrl: string;
  signer?: Wallet;
  contracts: {
    registry: string;
    ledger: string;
    inference: string;
  };
}

export interface Provider {
  address: string;
  name: string;
  endpoint: string;
  attestationHash: string;
  stake: bigint;
  registeredAt: number;
  active: boolean;
}

export interface Capability {
  model: string;
  pricePerInputToken: bigint;
  pricePerOutputToken: bigint;
  maxContextLength: number;
}

export interface Ledger {
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

export interface Service {
  provider: string;
  model: string;
  endpoint: string;
  pricePerInputToken: bigint;
  pricePerOutputToken: bigint;
  active: boolean;
}

export interface Settlement {
  user: string;
  provider: string;
  requestHash: string;
  inputTokens: number;
  outputTokens: number;
  fee: bigint;
  timestamp: number;
}

export interface AuthHeaders {
  'x-jeju-address': string;
  'x-jeju-nonce': string;
  'x-jeju-signature': string;
  'x-jeju-timestamp': string;
}

export interface InferenceRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface InferenceResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /**
   * Settlement data for on-chain verification
   * Only present if the request was authenticated with settlement nonce
   */
  settlement?: {
    provider: string;
    requestHash: string;
    inputTokens: number;
    outputTokens: number;
    nonce: number;
    signature: string;
  };
}
