/**
 * Decentralized Inference Registry SDK
 *
 * All models are registered on-chain with standardized metadata.
 * No hardcoded model data - providers register their own models.
 *
 * Supported Model Types:
 * - LLM: Text generation, code, chat
 * - IMAGE_GEN: Image generation (Stable Diffusion, etc.)
 * - VIDEO_GEN: Video generation
 * - AUDIO_GEN: Audio/music generation
 * - SPEECH_TO_TEXT: Transcription
 * - TEXT_TO_SPEECH: Voice synthesis
 * - EMBEDDING: Vector embeddings
 * - MULTIMODAL: Combined modalities
 *
 * Standard Model Metadata:
 * - modelId: Unique identifier (format: "creator/model-name")
 * - name: Human-readable model name
 * - creator: Organization/person who created the model
 * - modelType: LLM, IMAGE_GEN, VIDEO_GEN, etc.
 * - capabilities: Bitmask of supported features
 * - pricing: Per-token, per-image, per-second fees
 */

import {
  Contract,
  type ContractTransactionResponse,
  JsonRpcProvider,
  Wallet,
} from 'ethers';
import type {
  AddEndpointParams,
  ExtendedSDKConfig,
  GPUType,
  ModelDiscoveryFilter,
  ModelDiscoveryResult,
  ModelEndpoint,
  ModelHostingType,
  ModelPricing,
  ModelSourceType,
  ModelType,
  RegisteredModel,
  RegisterModelParams,
  TEEType,
} from './types';
import { ModelTypeEnum } from './types';
import { ZERO_ADDRESS } from './x402';

const MODEL_REGISTRY_ABI = [
  // Model Registration
  'function registerModel(string modelId, string name, string description, string version, uint8 sourceType, uint8 hostingType, string creatorName, string creatorWebsite, uint256 capabilities, uint256 contextWindow, tuple(uint256 pricePerInputToken, uint256 pricePerOutputToken, uint256 pricePerImageInput, uint256 minimumFee, string currency) pricing, tuple(uint256 minGpuVram, uint8 recommendedGpuType, uint256 minCpuCores, uint256 minMemory, bool teeRequired, uint8 teeType) hardware) payable returns (bytes32)',
  'function updateModel(string modelId, string description, uint256 capabilities, tuple(uint256 pricePerInputToken, uint256 pricePerOutputToken, uint256 pricePerImageInput, uint256 minimumFee, string currency) pricing)',
  'function deactivateModel(string modelId)',
  'function reactivateModel(string modelId)',

  // Endpoint Management
  'function addEndpoint(string modelId, string endpoint, string region, uint8 teeType, bytes32 attestationHash, uint256 maxConcurrent, tuple(uint256 pricePerInputToken, uint256 pricePerOutputToken, uint256 pricePerImageInput, uint256 minimumFee, string currency) pricing)',
  'function updateEndpoint(string modelId, uint256 endpointIndex, string endpoint, uint256 maxConcurrent)',
  'function removeEndpoint(string modelId, uint256 endpointIndex)',
  'function setEndpointLoad(string modelId, uint256 endpointIndex, uint256 load)',

  // View Functions - Models
  'function getModel(string modelId) view returns (tuple(string modelId, string name, string description, string version, uint8 sourceType, uint8 hostingType, tuple(string name, string website, bool verified, uint256 trustScore) creator, uint256 capabilities, uint256 contextWindow, tuple(uint256 pricePerInputToken, uint256 pricePerOutputToken, uint256 pricePerImageInput, uint256 minimumFee, string currency) pricing, tuple(uint256 minGpuVram, uint8 recommendedGpuType, uint256 minCpuCores, uint256 minMemory, bool teeRequired, uint8 teeType) hardware, uint256 registeredAt, uint256 updatedAt, bool active, uint256 totalRequests, uint256 avgLatencyMs, uint256 uptime))',
  'function getModelCount() view returns (uint256)',
  'function getAllModels() view returns (string[])',
  'function getActiveModels() view returns (string[])',
  'function getModelsByCreator(string creatorName) view returns (string[])',
  'function getModelsBySourceType(uint8 sourceType) view returns (string[])',
  'function getModelsByCapability(uint256 capability) view returns (string[])',

  // View Functions - Endpoints
  'function getEndpoints(string modelId) view returns (tuple(string modelId, address providerAddress, string endpoint, string region, uint8 teeType, bytes32 attestationHash, bool active, uint256 currentLoad, uint256 maxConcurrent, tuple(uint256 pricePerInputToken, uint256 pricePerOutputToken, uint256 pricePerImageInput, uint256 minimumFee, string currency) pricing)[])',
  'function getActiveEndpoints(string modelId) view returns (tuple(string modelId, address providerAddress, string endpoint, string region, uint8 teeType, bytes32 attestationHash, bool active, uint256 currentLoad, uint256 maxConcurrent, tuple(uint256 pricePerInputToken, uint256 pricePerOutputToken, uint256 pricePerImageInput, uint256 minimumFee, string currency) pricing)[])',
  'function getBestEndpoint(string modelId) view returns (tuple(string modelId, address providerAddress, string endpoint, string region, uint8 teeType, bytes32 attestationHash, bool active, uint256 currentLoad, uint256 maxConcurrent, tuple(uint256 pricePerInputToken, uint256 pricePerOutputToken, uint256 pricePerImageInput, uint256 minimumFee, string currency) pricing))',

  // Stats and Metrics
  'function recordRequest(string modelId, uint256 endpointIndex, uint256 latencyMs, bool success)',
  'function getModelStats(string modelId) view returns (uint256 totalRequests, uint256 avgLatencyMs, uint256 uptime)',

  // Admin
  'function setModelVerified(string modelId, bool verified)',
  'function setCreatorTrustScore(string creatorName, uint256 score)',
  'function minRegistrationStake() view returns (uint256)',
];

async function callContract<T>(
  contract: Contract,
  method: string,
  ...args: unknown[]
): Promise<T> {
  const fn = contract.getFunction(method);
  return fn(...args) as Promise<T>;
}

async function sendContract(
  contract: Contract,
  method: string,
  ...args: unknown[]
): Promise<ContractTransactionResponse> {
  const fn = contract.getFunction(method);
  return fn(...args) as Promise<ContractTransactionResponse>;
}

/**
 * Decentralized Inference Registry SDK
 *
 * All model discovery and registration happens on-chain.
 * No hardcoded model configurations.
 */
export class InferenceRegistrySDK {
  private provider: JsonRpcProvider;
  private signer: Wallet | null;
  private registry: Contract | null;

  constructor(config: ExtendedSDKConfig) {
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.signer = config.signer
      ? config.signer.connect(this.provider)
      : null;

    const signerOrProvider = this.signer || this.provider;
    this.registry = config.contracts.modelRegistry
      ? new Contract(
          config.contracts.modelRegistry,
          MODEL_REGISTRY_ABI,
          signerOrProvider
        )
      : null;
  }

  /** Register a new model in the on-chain registry */
  async registerModel(params: RegisterModelParams, stakeAmount?: bigint): Promise<string> {
    if (!this.registry) {
      throw new Error('Model registry contract not configured');
    }
    this.requireSigner();

    const minStake = await this.getMinRegistrationStake();
    const stake = stakeAmount ?? minStake;

    const tx = await sendContract(
      this.registry,
      'registerModel',
      params.modelId,
      params.name,
      params.description,
      params.version,
      params.sourceType,
      params.hostingType,
      params.creatorName,
      params.creatorWebsite,
      params.capabilities,
      params.contextWindow,
      params.pricing,
      params.hardware,
      { value: stake }
    );
    await tx.wait();
    return params.modelId;
  }

  /** Update model metadata */
  async updateModel(
    modelId: string,
    description: string,
    capabilities: number,
    pricing: ModelPricing
  ): Promise<void> {
    if (!this.registry) {
      throw new Error('Model registry contract not configured');
    }
    this.requireSigner();

    const tx = await sendContract(
      this.registry,
      'updateModel',
      modelId,
      description,
      capabilities,
      pricing
    );
    await tx.wait();
  }

  /** Deactivate a model */
  async deactivateModel(modelId: string): Promise<void> {
    if (!this.registry) {
      throw new Error('Model registry contract not configured');
    }
    this.requireSigner();

    const tx = await sendContract(this.registry, 'deactivateModel', modelId);
    await tx.wait();
  }

  /** Add an inference endpoint for a model */
  async addEndpoint(params: AddEndpointParams): Promise<void> {
    if (!this.registry) {
      throw new Error('Model registry contract not configured');
    }
    this.requireSigner();

    const model = await this.getModel(params.modelId);
    const pricing = {
      pricePerInputToken: params.pricing?.pricePerInputToken ?? model.pricing.pricePerInputToken,
      pricePerOutputToken: params.pricing?.pricePerOutputToken ?? model.pricing.pricePerOutputToken,
      pricePerImageInput: params.pricing?.pricePerImageInput ?? model.pricing.pricePerImageInput,
      minimumFee: params.pricing?.minimumFee ?? model.pricing.minimumFee,
      currency: params.pricing?.currency ?? model.pricing.currency,
    };

    const tx = await sendContract(
      this.registry,
      'addEndpoint',
      params.modelId,
      params.endpoint,
      params.region,
      params.teeType,
      params.attestationHash ?? '0x0000000000000000000000000000000000000000000000000000000000000000',
      params.maxConcurrent,
      pricing
    );
    await tx.wait();
  }

  /** Remove an endpoint */
  async removeEndpoint(modelId: string, endpointIndex: number): Promise<void> {
    if (!this.registry) {
      throw new Error('Model registry contract not configured');
    }
    this.requireSigner();

    const tx = await sendContract(
      this.registry,
      'removeEndpoint',
      modelId,
      endpointIndex
    );
    await tx.wait();
  }

  /** Get a specific model by ID from the on-chain registry */
  async getModel(modelId: string): Promise<RegisteredModel> {
    if (!this.registry) {
      throw new Error(`Model registry not configured - cannot fetch model: ${modelId}`);
    }

    const result = await callContract<{
      modelId: string;
      name: string;
      description: string;
      version: string;
      sourceType: number;
      hostingType: number;
      creator: { name: string; website: string; verified: boolean; trustScore: bigint };
      capabilities: bigint;
      contextWindow: bigint;
      pricing: {
        pricePerInputToken: bigint;
        pricePerOutputToken: bigint;
        pricePerImageInput: bigint;
        minimumFee: bigint;
        currency: string;
      };
      hardware: {
        minGpuVram: bigint;
        recommendedGpuType: number;
        minCpuCores: bigint;
        minMemory: bigint;
        teeRequired: boolean;
        teeType: number;
      };
      registeredAt: bigint;
      updatedAt: bigint;
      active: boolean;
      totalRequests: bigint;
      avgLatencyMs: bigint;
      uptime: bigint;
    }>(this.registry, 'getModel', modelId);

    // Infer model type from capabilities
    const capabilities = Number(result.capabilities);
    const modelType = this.inferModelType(capabilities);

    return {
      modelId: result.modelId,
      name: result.name,
      description: result.description,
      version: result.version,
      modelType,
      sourceType: result.sourceType as ModelSourceType,
      hostingType: result.hostingType as ModelHostingType,
      creator: {
        name: result.creator.name,
        website: result.creator.website,
        verified: result.creator.verified,
        trustScore: Number(result.creator.trustScore),
      },
      capabilities,
      contextWindow: Number(result.contextWindow),
      pricing: {
        pricePerInputToken: result.pricing.pricePerInputToken,
        pricePerOutputToken: result.pricing.pricePerOutputToken,
        pricePerImageInput: result.pricing.pricePerImageInput,
        pricePerImageOutput: 0n, // Default - extend contract ABI to support
        pricePerVideoSecond: 0n,
        pricePerAudioSecond: 0n,
        minimumFee: result.pricing.minimumFee,
        currency: result.pricing.currency,
      },
      hardware: {
        minGpuVram: Number(result.hardware.minGpuVram),
        recommendedGpuType: result.hardware.recommendedGpuType as GPUType,
        minCpuCores: Number(result.hardware.minCpuCores),
        minMemory: Number(result.hardware.minMemory),
        teeRequired: result.hardware.teeRequired,
        teeType: result.hardware.teeType as TEEType,
      },
      registeredAt: Number(result.registeredAt),
      updatedAt: Number(result.updatedAt),
      active: result.active,
      totalRequests: result.totalRequests,
      avgLatencyMs: Number(result.avgLatencyMs),
      uptime: Number(result.uptime),
    };
  }

  /** Infer model type from capabilities bitmask */
  private inferModelType(capabilities: number): ModelType {
    // Import capability constants
    const IMAGE_GEN = 256;
    const VIDEO_GEN = 8192;
    const AUDIO_GEN = 4096;
    const SPEECH_TO_TEXT = 1024;
    const TEXT_TO_SPEECH = 2048;
    const EMBEDDINGS = 32;
    const MULTIMODAL = 32768;

    if (capabilities & MULTIMODAL) return ModelTypeEnum.MULTIMODAL;
    if (capabilities & VIDEO_GEN) return ModelTypeEnum.VIDEO_GEN;
    if (capabilities & IMAGE_GEN) return ModelTypeEnum.IMAGE_GEN;
    if (capabilities & AUDIO_GEN) return ModelTypeEnum.AUDIO_GEN;
    if (capabilities & SPEECH_TO_TEXT) return ModelTypeEnum.SPEECH_TO_TEXT;
    if (capabilities & TEXT_TO_SPEECH) return ModelTypeEnum.TEXT_TO_SPEECH;
    if (capabilities & EMBEDDINGS) return ModelTypeEnum.EMBEDDING;
    return ModelTypeEnum.LLM;
  }

  /** Get all models from the on-chain registry */
  async getAllModels(): Promise<RegisteredModel[]> {
    if (!this.registry) {
      return [];
    }

    const modelIds = await callContract<string[]>(this.registry, 'getActiveModels');
    const models: RegisteredModel[] = [];

    for (const modelId of modelIds) {
      const model = await this.getModel(modelId);
      models.push(model);
    }

    return models;
  }

  /** Discover models matching filter criteria */
  async discoverModels(filter: ModelDiscoveryFilter): Promise<ModelDiscoveryResult[]> {
    const allModels = await this.getAllModels();
    const results: ModelDiscoveryResult[] = [];

    for (const model of allModels) {
      // Model type filter (LLM, IMAGE_GEN, VIDEO_GEN, etc.)
      if (filter.modelType !== undefined && model.modelType !== filter.modelType) continue;
      if (filter.sourceType !== undefined && model.sourceType !== filter.sourceType) continue;
      if (filter.hostingType !== undefined && model.hostingType !== filter.hostingType) continue;
      if (filter.capabilities && (model.capabilities & filter.capabilities) !== filter.capabilities) continue;
      if (filter.minContextWindow && model.contextWindow < filter.minContextWindow) continue;
      if (filter.maxPricePerInputToken && model.pricing.pricePerInputToken > filter.maxPricePerInputToken) continue;
      if (filter.maxPricePerOutputToken && model.pricing.pricePerOutputToken > filter.maxPricePerOutputToken) continue;
      if (filter.maxPricePerImage && model.pricing.pricePerImageOutput > filter.maxPricePerImage) continue;
      if (filter.maxPricePerSecond && model.pricing.pricePerVideoSecond > filter.maxPricePerSecond) continue;
      if (filter.requireTEE && !model.hardware.teeRequired) continue;
      if (filter.teeType !== undefined && model.hardware.teeType !== filter.teeType) continue;
      if (filter.creatorName && model.creator.name !== filter.creatorName) continue;
      if (filter.minUptime && model.uptime < filter.minUptime) continue;
      if (filter.active !== undefined && model.active !== filter.active) continue;

      let endpoints: ModelEndpoint[] = [];
      let recommendedEndpoint: ModelEndpoint | null = null;

      if (this.registry) {
        endpoints = await this.getEndpoints(model.modelId);
        if (filter.region) {
          endpoints = endpoints.filter(e => e.region === filter.region);
        }
        recommendedEndpoint = endpoints.find(e => e.active && e.currentLoad < 80) ?? null;
      }

      results.push({
        model,
        endpoints,
        recommendedEndpoint,
      });
    }

    return results;
  }

  /** Select a model based on criteria */
  async selectModel(params: {
    capabilities?: number;
    maxBudgetPerRequest?: bigint;
    preferDecentralized?: boolean;
    requireTEE?: boolean;
    creatorName?: string;
  }): Promise<RegisteredModel | null> {
    const filter: ModelDiscoveryFilter = {
      active: true,
    };

    if (params.capabilities) filter.capabilities = params.capabilities;
    if (params.maxBudgetPerRequest) filter.maxPricePerInputToken = params.maxBudgetPerRequest;
    if (params.preferDecentralized) filter.hostingType = 1; // DECENTRALIZED
    if (params.requireTEE) filter.requireTEE = true;
    if (params.creatorName) filter.creatorName = params.creatorName;

    const results = await this.discoverModels(filter);
    if (results.length === 0) return null;

    // Sort by price (cheapest first)
    results.sort((a, b) => {
      const priceA = a.model.pricing.pricePerInputToken + a.model.pricing.pricePerOutputToken;
      const priceB = b.model.pricing.pricePerInputToken + b.model.pricing.pricePerOutputToken;
      return Number(priceA - priceB);
    });

    return results[0]?.model ?? null;
  }

  /** Get all endpoints for a model */
  async getEndpoints(modelId: string): Promise<ModelEndpoint[]> {
    if (!this.registry) return [];

    const results = await callContract<Array<{
      modelId: string;
      providerAddress: string;
      endpoint: string;
      region: string;
      teeType: number;
      attestationHash: string;
      active: boolean;
      currentLoad: bigint;
      maxConcurrent: bigint;
      pricing: {
        pricePerInputToken: bigint;
        pricePerOutputToken: bigint;
        pricePerImageInput: bigint;
        minimumFee: bigint;
        currency: string;
      };
    }>>(this.registry, 'getEndpoints', modelId);

    return results.map(e => ({
      modelId: e.modelId,
      providerAddress: e.providerAddress,
      endpoint: e.endpoint,
      region: e.region,
      teeType: e.teeType as TEEType,
      attestationHash: e.attestationHash,
      active: e.active,
      currentLoad: Number(e.currentLoad),
      maxConcurrent: Number(e.maxConcurrent),
      pricing: {
        pricePerInputToken: e.pricing.pricePerInputToken,
        pricePerOutputToken: e.pricing.pricePerOutputToken,
        pricePerImageInput: e.pricing.pricePerImageInput,
        pricePerImageOutput: 0n,
        pricePerVideoSecond: 0n,
        pricePerAudioSecond: 0n,
        minimumFee: e.pricing.minimumFee,
        currency: e.pricing.currency,
      },
    }));
  }

  /** Get the best available endpoint for a model */
  async getBestEndpoint(modelId: string): Promise<ModelEndpoint | null> {
    if (!this.registry) return null;

    const result = await callContract<{
      modelId: string;
      providerAddress: string;
      endpoint: string;
      region: string;
      teeType: number;
      attestationHash: string;
      active: boolean;
      currentLoad: bigint;
      maxConcurrent: bigint;
      pricing: {
        pricePerInputToken: bigint;
        pricePerOutputToken: bigint;
        pricePerImageInput: bigint;
        minimumFee: bigint;
        currency: string;
      };
    }>(this.registry, 'getBestEndpoint', modelId);

    if (result.providerAddress === ZERO_ADDRESS) return null;

    return {
      modelId: result.modelId,
      providerAddress: result.providerAddress,
      endpoint: result.endpoint,
      region: result.region,
      teeType: result.teeType as TEEType,
      attestationHash: result.attestationHash,
      active: result.active,
      currentLoad: Number(result.currentLoad),
      maxConcurrent: Number(result.maxConcurrent),
      pricing: {
        pricePerInputToken: result.pricing.pricePerInputToken,
        pricePerOutputToken: result.pricing.pricePerOutputToken,
        pricePerImageInput: result.pricing.pricePerImageInput,
        pricePerImageOutput: 0n,
        pricePerVideoSecond: 0n,
        pricePerAudioSecond: 0n,
        minimumFee: result.pricing.minimumFee,
        currency: result.pricing.currency,
      },
    };
  }

  // ============================================================================
  // Convenience Methods by Model Type
  // ============================================================================

  /** Get all LLM models */
  async getLLMs(): Promise<RegisteredModel[]> {
    return this.discoverModels({ modelType: ModelTypeEnum.LLM }).then(r => r.map(x => x.model));
  }

  /** Get all image generation models */
  async getImageGenerators(): Promise<RegisteredModel[]> {
    return this.discoverModels({ modelType: ModelTypeEnum.IMAGE_GEN }).then(r => r.map(x => x.model));
  }

  /** Get all video generation models */
  async getVideoGenerators(): Promise<RegisteredModel[]> {
    return this.discoverModels({ modelType: ModelTypeEnum.VIDEO_GEN }).then(r => r.map(x => x.model));
  }

  /** Get all audio generation models */
  async getAudioGenerators(): Promise<RegisteredModel[]> {
    return this.discoverModels({ modelType: ModelTypeEnum.AUDIO_GEN }).then(r => r.map(x => x.model));
  }

  /** Get all speech-to-text models */
  async getSpeechToTextModels(): Promise<RegisteredModel[]> {
    return this.discoverModels({ modelType: ModelTypeEnum.SPEECH_TO_TEXT }).then(r => r.map(x => x.model));
  }

  /** Get all text-to-speech models */
  async getTextToSpeechModels(): Promise<RegisteredModel[]> {
    return this.discoverModels({ modelType: ModelTypeEnum.TEXT_TO_SPEECH }).then(r => r.map(x => x.model));
  }

  /** Get all embedding models */
  async getEmbeddingModels(): Promise<RegisteredModel[]> {
    return this.discoverModels({ modelType: ModelTypeEnum.EMBEDDING }).then(r => r.map(x => x.model));
  }

  /** Get all multimodal models */
  async getMultimodalModels(): Promise<RegisteredModel[]> {
    return this.discoverModels({ modelType: ModelTypeEnum.MULTIMODAL }).then(r => r.map(x => x.model));
  }

  /** Get minimum stake required to register a model */
  async getMinRegistrationStake(): Promise<bigint> {
    if (!this.registry) return 0n;
    return callContract<bigint>(this.registry, 'minRegistrationStake');
  }

  /** Check if a model has capability */
  hasCapability(model: RegisteredModel, capability: number): boolean {
    return (model.capabilities & capability) === capability;
  }

  /** Estimate cost for inference */
  estimateCost(
    model: RegisteredModel,
    inputTokens: number,
    outputTokens: number,
    imageCount: number = 0
  ): bigint {
    const inputCost = model.pricing.pricePerInputToken * BigInt(inputTokens) / 1000n;
    const outputCost = model.pricing.pricePerOutputToken * BigInt(outputTokens) / 1000n;
    const imageCost = model.pricing.pricePerImageInput * BigInt(imageCount);
    const total = inputCost + outputCost + imageCost;
    return total > model.pricing.minimumFee ? total : model.pricing.minimumFee;
  }

  private requireSigner(): Wallet {
    if (!this.signer) {
      throw new Error('Signer required for this operation');
    }
    return this.signer;
  }

  getAddress(): string | null {
    return this.signer?.address ?? null;
  }
}

export function createInferenceRegistry(config: ExtendedSDKConfig): InferenceRegistrySDK {
  return new InferenceRegistrySDK(config);
}
