/**
 * ERC-8004 Prediction Game Types
 * Based on the game design document
 */

export enum Outcome {
  YES = 'YES',
  NO = 'NO',
  PENDING = 'PENDING'
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  EARLY = 'EARLY',      // Days 1-10
  MID = 'MID',          // Days 11-20
  LATE = 'LATE',        // Days 21-29
  REVEAL = 'REVEAL',    // Day 30
  ENDED = 'ENDED'
}

export interface Agent {
  id: string;                    // Unique agent ID (from ERC-8004)
  name: string;                  // Display name
  type: 'human' | 'ai';          // Agent type
  reputation: number;            // Social integrity score (0-100)
  wins: number;                  // Total wins across games
  isNPC?: boolean;               // If true, this is an NPC
}

export interface NPC {
  id: string;
  name: string;
  role: 'insider' | 'rumor' | 'celebrity' | 'media' | 'organization';
  bias: 'truthful' | 'deceptive' | 'neutral';
  bio: string;                   // Satirical description
  tendsToBeTruthful: boolean;    // For game logic
}

export interface Post {
  id: string;
  authorId: string;              // Agent or NPC ID
  authorName: string;
  content: string;               // Max 280 chars
  timestamp: Date;
  gameDay: number;               // In-game day (1-30)
  isSystemMessage?: boolean;
  reactions?: { [agentId: string]: 'like' | 'dislike' };
  replyTo?: string;              // ID of post being replied to
}

export interface DirectMessage {
  id: string;
  from: string;                  // Agent ID
  to: string;                    // Agent ID
  content: string;
  timestamp: Date;
  gameDay: number;
  encrypted: boolean;            // If using TEE encryption
}

export interface GroupChat {
  id: string;
  name: string;
  members: string[];             // Agent IDs
  messages: DirectMessage[];
  createdBy: string;
  createdAt: Date;
}

export interface Bet {
  agentId: string;
  outcome: Outcome.YES | Outcome.NO;
  amount: number;
  timestamp: Date;
  gameDay: number;
  odds: number;                  // Odds at time of bet
}

export interface MarketState {
  yesShares: number;
  noShares: number;
  yesOdds: number;               // Percentage (0-100)
  noOdds: number;                // Percentage (0-100)
  totalVolume: number;
  bets: Bet[];
}

export interface GameScenario {
  id: string;
  title: string;
  question: string;              // The Yes/No question
  description: string;           // Context for players
  secretOutcome: Outcome;        // Known only to game system
  outcomeCommitment: string;     // Hash of outcome for trustless oracle
  npcs: NPC[];                   // NPCs involved in this scenario
  timeline: GameEvent[];         // Scheduled events
}

export interface GameEvent {
  day: number;                   // Game day (1-30)
  time?: string;                 // Optional time (HH:MM)
  type: 'news' | 'announcement' | 'leak' | 'scandal' | 'system';
  author: string;                // NPC ID or 'SYSTEM'
  content: string;
  isPublic: boolean;             // If false, sent as DM to select agents
  targetAgents?: string[];       // If private, which agents receive it
  triggerCondition?: string;     // Optional: condition to fire this event
}

export interface InsiderClue {
  agentId: string;
  npcId: string;
  content: string;
  isTruthful: boolean;           // Whether this clue is accurate
  deliveredAt: Date;
  gameDay: number;
}

export interface GameSession {
  id: string;
  scenario: GameScenario;
  agents: Agent[];
  phase: GamePhase;
  currentDay: number;            // 1-30
  startTime: Date;
  endTime?: Date;
  market: MarketState;
  feed: Post[];
  directMessages: Map<string, DirectMessage[]>;  // Keyed by "agentId1-agentId2"
  groupChats: GroupChat[];
  insiderClues: InsiderClue[];
  bettingOpen: boolean;
  revealed: boolean;
  finalOutcome?: Outcome;
}

export interface ReputationFeedback {
  fromAgentId: string;
  toAgentId: string;
  helpful: boolean;              // True = positive, false = negative
  comment?: string;
}

export interface GameResult {
  sessionId: string;
  outcome: Outcome;
  winners: string[];             // Agent IDs
  payouts: { [agentId: string]: number };
  marketHistory: MarketState[];
  reputationChanges: { [agentId: string]: number };
}

// API Request/Response types
export interface JoinGameRequest {
  agentId: string;
  signature?: string;            // For verification
}

export interface PostMessageRequest {
  agentId: string;
  content: string;
  replyTo?: string;
}

export interface SendDMRequest {
  from: string;
  to: string;
  content: string;
}

export interface PlaceBetRequest {
  agentId: string;
  outcome: Outcome.YES | Outcome.NO;
  amount: number;
}

export interface CreateGroupChatRequest {
  agentId: string;
  name: string;
  members: string[];             // Agent IDs to invite
}

