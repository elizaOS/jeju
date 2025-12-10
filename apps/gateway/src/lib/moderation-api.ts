import { 
  createModerationAPI, 
  type ModerationConfig,
  type ModerationBanStatus as BanStatus,
  type ModeratorProfile,
  type ModerationCase,
  type Report,
  type AgentLabels,
  type ModerationStats,
  type TransactionRequest,
} from '@jeju/shared';
import { Address } from 'viem';
import { baseSepolia } from 'viem/chains';

export type { BanStatus, ModeratorProfile, ModerationCase, Report, AgentLabels, ModerationStats, TransactionRequest };

// Gateway-specific configuration from environment
// Support both VITE_ prefixed (for dev) and non-prefixed (for production) env vars
const config: ModerationConfig = {
  chain: baseSepolia,
  rpcUrl: process.env.VITE_RPC_URL || process.env.RPC_URL || 'https://sepolia.base.org',
  banManagerAddress: (process.env.VITE_BAN_MANAGER_ADDRESS || process.env.BAN_MANAGER_ADDRESS) as Address | undefined,
  moderationMarketplaceAddress: (process.env.VITE_MODERATION_MARKETPLACE_ADDRESS || process.env.MODERATION_MARKETPLACE_ADDRESS) as Address | undefined,
  reportingSystemAddress: (process.env.VITE_REPORTING_SYSTEM_ADDRESS || process.env.REPORTING_SYSTEM_ADDRESS) as Address | undefined,
  reputationLabelManagerAddress: (process.env.VITE_REPUTATION_LABEL_MANAGER_ADDRESS || process.env.REPUTATION_LABEL_MANAGER_ADDRESS) as Address | undefined,
};

// Create singleton API instance
const moderationAPI = createModerationAPI(config);

// Export API methods as standalone functions for backward compatibility
export const checkBanStatus = moderationAPI.checkBanStatus.bind(moderationAPI);
export const getModeratorProfile = moderationAPI.getModeratorProfile.bind(moderationAPI);
export const getModerationCases = moderationAPI.getModerationCases.bind(moderationAPI);
export const getModerationCase = moderationAPI.getModerationCase.bind(moderationAPI);
export const getReports = moderationAPI.getReports.bind(moderationAPI);
export const getAgentLabels = moderationAPI.getAgentLabels.bind(moderationAPI);
export const getModerationStats = moderationAPI.getModerationStats.bind(moderationAPI);

// Transaction preparation
export const prepareStakeTransaction = moderationAPI.prepareStake.bind(moderationAPI);
export const prepareReportTransaction = moderationAPI.prepareReport.bind(moderationAPI);
export const prepareVoteTransaction = moderationAPI.prepareVote.bind(moderationAPI);
export const prepareChallengeTransaction = moderationAPI.prepareChallenge.bind(moderationAPI);
export const prepareAppealTransaction = moderationAPI.prepareAppeal.bind(moderationAPI);
