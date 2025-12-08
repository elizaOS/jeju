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
  NodeMetrics,
  ProviderConfig,
} from './node';

// Export node components
export {
  ComputeNodeServer,
  countTokens,
  createInferenceEngine,
  detectHardware,
  formatHardwareInfo,
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
  ComputeResources,
  CreateRentalParams,
  GPUType,
  InferenceRequest,
  InferenceResponse,
  Ledger,
  Provider,
  ProviderResourcesInfo,
  ProviderSubAccount,
  Rental,
  RentalStatus,
  ResourcePricing,
  SDKConfig,
  Service,
  Settlement,
} from './sdk';

// Export SDK
export { JejuComputeSDK, createSDK } from './sdk';

// Export enums
export { GPUTypeEnum, RentalStatusEnum } from './sdk/types';

/**
 * @deprecated Use JejuComputeSDK instead. BabylonComputeSDK is kept for backwards compatibility only.
 */
export { JejuComputeSDK as BabylonComputeSDK } from './sdk';

// Export Moderation SDK types
export type { BanRecord, ModerationSDKConfig, Stake } from './sdk/moderation';

// Export Moderation SDK
export {
  createModerationSDK,
  ModerationSDK,
  StakeType,
} from './sdk/moderation';
