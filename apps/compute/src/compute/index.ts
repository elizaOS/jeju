/**
 * Jeju Compute Marketplace
 *
 * A decentralized compute network for AI inference with ERC-8004 integration.
 */

// Export node types
export type {
  AttestationReport,
  AuthHeaders,
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  HardwareInfo,
  ModelConfig,
  ProviderConfig,
} from './node';

// Export node components
export {
  ComputeNodeServer,
  countTokens,
  createInferenceEngine,
  detectHardware,
  generateHardwareHash,
  generateSimulatedAttestation,
  getAttestationHash,
  isAttestationFresh,
  MockInferenceEngine,
  OllamaInferenceEngine,
  startComputeNode,
  verifyAttestation,
} from './node';

// Export SDK types
export type {
  Capability,
  InferenceRequest,
  InferenceResponse,
  Ledger,
  Provider,
  ProviderSubAccount,
  SDKConfig,
  Service,
  Settlement,
} from './sdk';

// Export SDK
export { JejuComputeSDK, createSDK } from './sdk';

// Legacy alias for backwards compatibility
export { JejuComputeSDK as BabylonComputeSDK } from './sdk';

// Export Moderation SDK types
export type { BanRecord, ModerationSDKConfig, Stake } from './sdk/moderation';

// Export Moderation SDK
export {
  createModerationSDK,
  ModerationSDK,
  StakeType,
} from './sdk/moderation';
