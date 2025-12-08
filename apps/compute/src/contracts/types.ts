/**
 * Contract Types
 *
 * TypeScript interfaces for the smart contract state and events
 */

import type { Address, Hex } from 'viem';

/**
 * JSON-serializable value types (self-contained to avoid external dependencies)
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue };

// ============================================================================
// Game Management Contract Types
// ============================================================================

export interface GameState {
  // Current state CID (IPFS content identifier)
  currentStateCID: string;
  // Hash of the encrypted state for integrity
  stateHash: Hex;
  // Version number for state updates
  stateVersion: number;
  // Authorized TEE operator address
  operatorAddress: Address | null;
  // Whether operator is active
  operatorActive: boolean;
  // Last heartbeat timestamp
  lastHeartbeat: number;
  // Key version for encryption
  keyVersion: number;
}

export interface GameConfig {
  // Maximum funds operator can withdraw per day
  dailyWithdrawalLimit: bigint;
  // Heartbeat timeout (milliseconds) before marking inactive
  heartbeatTimeout: number;
  // Minimum interval between state updates
  minStateUpdateInterval: number;
}

export type GameEvent =
  | { type: 'StateUpdated'; cid: string; hash: Hex; version: number }
  | { type: 'OperatorRegistered'; address: Address }
  | { type: 'OperatorDeactivated'; address: Address; reason: string }
  | { type: 'HeartbeatReceived'; timestamp: number }
  | { type: 'FundsWithdrawn'; amount: bigint; recipient: Address }
  | { type: 'KeyRotationRequested'; newVersion: number }
  | { type: 'TrainingRecorded'; datasetCID: string; modelHash: Hex };

// ============================================================================
// Staking Contract Types
// ============================================================================

export interface StakeInfo {
  amount: bigint;
  stakedAt: number;
  lockedUntil: number;
  rewardsEarned: bigint;
}

export interface StakingState {
  totalStaked: bigint;
  stakes: Map<Address, StakeInfo>;
  rewardPool: bigint;
  operatorBond: bigint;
}

export type StakingEvent =
  | { type: 'Staked'; address: Address; amount: bigint }
  | { type: 'Unstaked'; address: Address; amount: bigint }
  | { type: 'RewardDistributed'; amount: bigint }
  | { type: 'OperatorBondPosted'; address: Address; amount: bigint };

// ============================================================================
// Governance Contract Types
// ============================================================================

export interface Proposal {
  id: number;
  proposer: Address;
  description: string;
  targetContract: string;
  action: string;
  params: JsonValue;
  votesFor: bigint;
  votesAgainst: bigint;
  createdAt: number;
  votingEndsAt: number;
  executed: boolean;
  passed: boolean;
}

export interface VotingPower {
  address: Address;
  power: bigint;
  lockedSince: number;
  eligible: boolean; // Must be locked for 30 days
}

export interface GovernanceState {
  proposals: Map<number, Proposal>;
  votingPowers: Map<Address, VotingPower>;
  nextProposalId: number;
  votingPeriod: number; // Duration of voting in ms
  lockPeriod: number; // 30 days before voting eligibility
  quorum: bigint; // Minimum votes needed
}

export type GovernanceEvent =
  | { type: 'ProposalCreated'; proposalId: number; proposer: Address }
  | {
      type: 'VoteCast';
      proposalId: number;
      voter: Address;
      support: boolean;
      weight: bigint;
    }
  | { type: 'ProposalExecuted'; proposalId: number }
  | { type: 'ProposalFailed'; proposalId: number }
  | { type: 'VotingPowerLocked'; address: Address; amount: bigint };

// ============================================================================
// Security Council Contract Types
// ============================================================================

export interface CouncilMember {
  address: Address;
  addedAt: number;
  active: boolean;
}

export interface KeyRotationRequest {
  id: number;
  requestedAt: number;
  newKeyVersion: number;
  approvals: Set<Address>;
  executed: boolean;
}

export interface SecurityCouncilState {
  members: Map<Address, CouncilMember>;
  requiredApprovals: number; // e.g., 3 of 5
  keyRotationRequests: Map<number, KeyRotationRequest>;
  currentKeyVersion: number;
  nextRequestId: number;
}

export type SecurityCouncilEvent =
  | { type: 'KeyRotationRequested'; requestId: number; requester: Address }
  | { type: 'KeyRotationApproved'; requestId: number; approver: Address }
  | { type: 'KeyRotationExecuted'; requestId: number; newVersion: number }
  | { type: 'MemberAdded'; address: Address }
  | { type: 'MemberRemoved'; address: Address };

// ============================================================================
// Combined Contract System
// ============================================================================

export interface ContractSystem {
  game: GameState;
  gameConfig: GameConfig;
  staking: StakingState;
  governance: GovernanceState;
  securityCouncil: SecurityCouncilState;
  treasury: bigint;
  blockNumber: number;
  timestamp: number;
}

export type ContractEvent =
  | ({ contract: 'game' } & GameEvent)
  | ({ contract: 'staking' } & StakingEvent)
  | ({ contract: 'governance' } & GovernanceEvent)
  | ({ contract: 'securityCouncil' } & SecurityCouncilEvent);
