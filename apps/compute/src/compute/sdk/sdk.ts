/**
 * Jeju Compute SDK
 *
 * Client library for interacting with the Jeju Compute Marketplace
 */

import {
  Contract,
  type ContractTransactionResponse,
  formatEther,
  JsonRpcProvider,
  parseEther,
  Wallet,
} from 'ethers';
import type {
  AuthHeaders,
  Capability,
  InferenceRequest,
  InferenceResponse,
  Ledger,
  Provider,
  ProviderSubAccount,
  SDKConfig,
  Service,
} from './types';

// ABI fragments for the contracts
const REGISTRY_ABI = [
  'function register(string name, string endpoint, bytes32 attestationHash) payable returns (address)',
  'function updateEndpoint(string endpoint)',
  'function updateAttestation(bytes32 attestationHash)',
  'function deactivate()',
  'function addStake() payable',
  'function withdraw(uint256 amount)',
  'function addCapability(string model, uint256 pricePerInputToken, uint256 pricePerOutputToken, uint256 maxContextLength)',
  'function getProvider(address provider) view returns (tuple(address owner, string name, string endpoint, bytes32 attestationHash, uint256 stake, uint256 registeredAt, bool active))',
  'function getCapabilities(address provider) view returns (tuple(string model, uint256 pricePerInputToken, uint256 pricePerOutputToken, uint256 maxContextLength)[])',
  'function isActive(address provider) view returns (bool)',
  'function getActiveProviders() view returns (address[])',
  'function getProviderStake(address provider) view returns (uint256)',
  'function MIN_PROVIDER_STAKE() view returns (uint256)',
];

const LEDGER_ABI = [
  'function createLedger() payable',
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function transferToProvider(address provider, uint256 amount)',
  'function acknowledgeProvider(address provider)',
  'function requestRefund(address provider, uint256 amount)',
  'function completeRefund(address provider)',
  'function setInferenceContract(address inference)',
  'function getLedger(address user) view returns (tuple(uint256 totalBalance, uint256 availableBalance, uint256 lockedBalance, uint256 createdAt))',
  'function getSubAccount(address user, address provider) view returns (tuple(uint256 balance, uint256 pendingRefund, uint256 refundUnlockTime, bool acknowledged))',
  'function getAvailableBalance(address user) view returns (uint256)',
  'function getProviderBalance(address user, address provider) view returns (uint256)',
  'function isAcknowledged(address user, address provider) view returns (bool)',
  'function ledgerExists(address user) view returns (bool)',
  'function inferenceContract() view returns (address)',
  'function MIN_DEPOSIT() view returns (uint256)',
];

const INFERENCE_ABI = [
  'function registerService(string model, string endpoint, uint256 pricePerInputToken, uint256 pricePerOutputToken)',
  'function deactivateService(uint256 serviceIndex)',
  'function setSigner(address signer)',
  'function settle(address provider, bytes32 requestHash, uint256 inputTokens, uint256 outputTokens, uint256 nonce, bytes signature)',
  'function getServices(address provider) view returns (tuple(address provider, string model, string endpoint, uint256 pricePerInputToken, uint256 pricePerOutputToken, bool active)[])',
  'function getActiveServices(address provider) view returns (tuple(address provider, string model, string endpoint, uint256 pricePerInputToken, uint256 pricePerOutputToken, bool active)[])',
  'function getNonce(address user, address provider) view returns (uint256)',
  'function getSigner(address provider) view returns (address)',
  'function calculateFee(address provider, uint256 inputTokens, uint256 outputTokens) view returns (uint256)',
];

// Helper to call contract methods safely
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
 * Jeju Compute SDK
 */
export class JejuComputeSDK {
  private rpcProvider: JsonRpcProvider;
  private signer: Wallet | null;
  private registry: Contract;
  private ledger: Contract;
  private inferenceContract: Contract;

  constructor(config: SDKConfig) {
    this.rpcProvider = new JsonRpcProvider(config.rpcUrl);
    this.signer = config.signer
      ? config.signer.connect(this.rpcProvider)
      : null;

    // Initialize contracts
    const signerOrProvider = this.signer || this.rpcProvider;
    this.registry = new Contract(
      config.contracts.registry,
      REGISTRY_ABI,
      signerOrProvider
    );
    this.ledger = new Contract(
      config.contracts.ledger,
      LEDGER_ABI,
      signerOrProvider
    );
    this.inferenceContract = new Contract(
      config.contracts.inference,
      INFERENCE_ABI,
      signerOrProvider
    );
  }

  // ============ Registry Functions ============

  /**
   * Register as a compute provider
   */
  async registerProvider(
    name: string,
    endpoint: string,
    attestationHash: string,
    stakeAmount: bigint
  ): Promise<string> {
    const signer = this.requireSigner();
    const tx = await sendContract(
      this.registry,
      'register',
      name,
      endpoint,
      attestationHash,
      { value: stakeAmount }
    );
    await tx.wait();
    return signer.address;
  }

  /**
   * Get provider info
   */
  async getProvider(address: string): Promise<Provider> {
    const result = await callContract<{
      owner: string;
      name: string;
      endpoint: string;
      attestationHash: string;
      stake: bigint;
      registeredAt: bigint;
      active: boolean;
    }>(this.registry, 'getProvider', address);
    return {
      address,
      name: result.name,
      endpoint: result.endpoint,
      attestationHash: result.attestationHash,
      stake: result.stake,
      registeredAt: Number(result.registeredAt),
      active: result.active,
    };
  }

  /**
   * Get provider capabilities
   */
  async getCapabilities(address: string): Promise<Capability[]> {
    const result = await callContract<Capability[]>(
      this.registry,
      'getCapabilities',
      address
    );
    return result.map((c) => ({
      model: c.model,
      pricePerInputToken: c.pricePerInputToken,
      pricePerOutputToken: c.pricePerOutputToken,
      maxContextLength: Number(c.maxContextLength),
    }));
  }

  /**
   * Get all active providers
   */
  async getActiveProviders(): Promise<string[]> {
    return callContract<string[]>(this.registry, 'getActiveProviders');
  }

  /**
   * Check if provider is active
   */
  async isProviderActive(address: string): Promise<boolean> {
    return callContract<boolean>(this.registry, 'isActive', address);
  }

  /**
   * Register as a provider
   * @param name Provider name
   * @param endpoint API endpoint URL
   * @param stake Amount to stake (in wei)
   * @param attestationHash Optional TEE attestation hash
   */
  async register(
    name: string,
    endpoint: string,
    stake: bigint,
    attestationHash = '0x0000000000000000000000000000000000000000000000000000000000000000'
  ): Promise<void> {
    this.requireSigner(); // Ensure we have a signer

    const tx = await sendContract(
      this.registry,
      'register',
      name,
      endpoint,
      attestationHash,
      { value: stake }
    );
    await tx.wait();
  }

  /**
   * Register an inference service
   * @param model Model name
   * @param endpoint Service endpoint
   * @param pricePerInputToken Price per input token (wei)
   * @param pricePerOutputToken Price per output token (wei)
   */
  async registerService(
    model: string,
    endpoint: string,
    pricePerInputToken: bigint,
    pricePerOutputToken: bigint
  ): Promise<void> {
    this.requireSigner(); // Ensure we have a signer

    const tx = await sendContract(
      this.inferenceContract,
      'registerService',
      model,
      endpoint,
      pricePerInputToken,
      pricePerOutputToken
    );
    await tx.wait();
  }

  // ============ Service Discovery ============

  /**
   * Get services for a provider
   */
  async getProviderServices(provider: string): Promise<Service[]> {
    const result = await callContract<
      Array<{
        provider: string;
        model: string;
        endpoint: string;
        pricePerInputToken: bigint;
        pricePerOutputToken: bigint;
        active: boolean;
      }>
    >(this.inferenceContract, 'getServices', provider);

    return result.map((s) => ({
      provider: s.provider,
      model: s.model,
      endpoint: s.endpoint,
      pricePerInputToken: s.pricePerInputToken,
      pricePerOutputToken: s.pricePerOutputToken,
      active: s.active,
    }));
  }

  /**
   * Get active services for a provider
   */
  async getActiveServices(provider: string): Promise<Service[]> {
    const result = await callContract<
      Array<{
        provider: string;
        model: string;
        endpoint: string;
        pricePerInputToken: bigint;
        pricePerOutputToken: bigint;
        active: boolean;
      }>
    >(this.inferenceContract, 'getActiveServices', provider);

    return result.map((s) => ({
      provider: s.provider,
      model: s.model,
      endpoint: s.endpoint,
      pricePerInputToken: s.pricePerInputToken,
      pricePerOutputToken: s.pricePerOutputToken,
      active: s.active,
    }));
  }

  /**
   * Discover all active providers with their services
   * Returns a list of providers with their info and available services
   */
  async discoverProviders(): Promise<
    Array<{
      provider: Provider;
      services: Service[];
    }>
  > {
    const activeProviders = await this.getActiveProviders();

    const results = await Promise.all(
      activeProviders.map(async (address) => {
        const provider = await this.getProvider(address);
        const services = await this.getActiveServices(address);
        return { provider, services };
      })
    );

    // Only return providers that have active services
    return results.filter((r) => r.services.length > 0);
  }

  /**
   * Find providers offering a specific model
   */
  async findProvidersForModel(
    modelName: string
  ): Promise<Array<{ provider: Provider; service: Service }>> {
    const discoveries = await this.discoverProviders();

    const matches: Array<{ provider: Provider; service: Service }> = [];

    for (const { provider, services } of discoveries) {
      const service = services.find(
        (s) => s.model.toLowerCase() === modelName.toLowerCase() && s.active
      );
      if (service) {
        matches.push({ provider, service });
      }
    }

    return matches;
  }

  // ============ Ledger Functions ============

  /**
   * Create and deposit to ledger
   */
  async deposit(amount: bigint): Promise<void> {
    const signer = this.requireSigner();
    const exists = await callContract<boolean>(
      this.ledger,
      'ledgerExists',
      signer.address
    );

    if (!exists) {
      const tx = await sendContract(this.ledger, 'createLedger', {
        value: amount,
      });
      await tx.wait();
    } else {
      const tx = await sendContract(this.ledger, 'deposit', { value: amount });
      await tx.wait();
    }
  }

  /**
   * Withdraw from ledger
   */
  async withdraw(amount: bigint): Promise<void> {
    this.requireSigner();
    const tx = await sendContract(this.ledger, 'withdraw', amount);
    await tx.wait();
  }

  /**
   * Transfer to provider sub-account
   */
  async transferToProvider(provider: string, amount: bigint): Promise<void> {
    this.requireSigner();
    const tx = await sendContract(
      this.ledger,
      'transferToProvider',
      provider,
      amount
    );
    await tx.wait();
  }

  /**
   * Acknowledge provider signer
   */
  async acknowledgeProvider(provider: string): Promise<void> {
    this.requireSigner();
    const tx = await sendContract(this.ledger, 'acknowledgeProvider', provider);
    await tx.wait();
  }

  /**
   * Get ledger balance
   */
  async getLedger(address?: string): Promise<Ledger> {
    const addr = address || this.signer?.address;
    if (!addr) throw new Error('Address required');

    const result = await callContract<{
      totalBalance: bigint;
      availableBalance: bigint;
      lockedBalance: bigint;
      createdAt: bigint;
    }>(this.ledger, 'getLedger', addr);
    return {
      totalBalance: result.totalBalance,
      availableBalance: result.availableBalance,
      lockedBalance: result.lockedBalance,
      createdAt: Number(result.createdAt),
    };
  }

  /**
   * Get provider sub-account
   */
  async getSubAccount(
    user: string,
    provider: string
  ): Promise<ProviderSubAccount> {
    const result = await callContract<{
      balance: bigint;
      pendingRefund: bigint;
      refundUnlockTime: bigint;
      acknowledged: boolean;
    }>(this.ledger, 'getSubAccount', user, provider);
    return {
      balance: result.balance,
      pendingRefund: result.pendingRefund,
      refundUnlockTime: Number(result.refundUnlockTime),
      acknowledged: result.acknowledged,
    };
  }

  /**
   * Check if provider is acknowledged
   */
  async isAcknowledged(user: string, provider: string): Promise<boolean> {
    return callContract<boolean>(this.ledger, 'isAcknowledged', user, provider);
  }

  // ============ Inference Functions ============

  /**
   * Get services for a provider
   */
  async getServices(provider: string): Promise<Service[]> {
    const result = await callContract<Service[]>(
      this.inferenceContract,
      'getActiveServices',
      provider
    );
    return result.map((s) => ({
      provider: s.provider,
      model: s.model,
      endpoint: s.endpoint,
      pricePerInputToken: s.pricePerInputToken,
      pricePerOutputToken: s.pricePerOutputToken,
      active: s.active,
    }));
  }

  /**
   * Calculate fee for a request
   */
  async calculateFee(
    provider: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<bigint> {
    return callContract<bigint>(
      this.inferenceContract,
      'calculateFee',
      provider,
      inputTokens,
      outputTokens
    );
  }

  /**
   * Get current nonce for user-provider pair
   */
  async getNonce(user: string, provider: string): Promise<number> {
    const nonce = await callContract<bigint>(
      this.inferenceContract,
      'getNonce',
      user,
      provider
    );
    return Number(nonce);
  }

  /**
   * Generate auth headers for inference request
   * Includes the user's current on-chain nonce for settlement
   */
  async generateAuthHeaders(
    provider: string
  ): Promise<AuthHeaders & { 'x-jeju-settlement-nonce': string }> {
    const signer = this.requireSigner();

    const nonce = crypto.randomUUID();
    const timestamp = Date.now().toString();
    const message = `${signer.address}:${nonce}:${timestamp}:${provider}`;
    const signature = await signer.signMessage(message);

    // Get the current on-chain nonce for settlement
    const settlementNonce = await this.getNonce(signer.address, provider);

    return {
      'x-jeju-address': signer.address,
      'x-jeju-nonce': nonce,
      'x-jeju-signature': signature,
      'x-jeju-timestamp': timestamp,
      'x-jeju-settlement-nonce': settlementNonce.toString(),
    };
  }

  /**
   * Make an inference request to a provider
   */
  async sendInference(
    provider: string,
    request: InferenceRequest
  ): Promise<InferenceResponse> {
    // Get provider info
    const providerInfo = await this.getProvider(provider);
    if (!providerInfo.active) {
      throw new Error('Provider is not active');
    }

    // Generate auth headers
    const headers = await this.generateAuthHeaders(provider);

    // Make request
    const response = await fetch(
      `${providerInfo.endpoint}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Inference failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Settle an inference request using settlement data from the response
   * The provider must have signed the settlement data correctly
   */
  async settle(
    provider: string,
    requestHash: string,
    inputTokens: number,
    outputTokens: number,
    signature: string
  ): Promise<void> {
    const signer = this.requireSigner();

    const nonce = await this.getNonce(signer.address, provider);
    const tx = await sendContract(
      this.inferenceContract,
      'settle',
      provider,
      requestHash,
      inputTokens,
      outputTokens,
      nonce,
      signature
    );
    await tx.wait();
  }

  /**
   * Settle from an inference response
   * Convenience method that extracts settlement data from the response
   */
  async settleFromResponse(response: InferenceResponse): Promise<void> {
    if (!response.settlement) {
      throw new Error(
        'Response does not contain settlement data. Was the request authenticated with settlement nonce?'
      );
    }

    const {
      provider,
      requestHash,
      inputTokens,
      outputTokens,
      nonce,
      signature,
    } = response.settlement;

    // Verify the nonce matches our current on-chain nonce
    const signer = this.requireSigner();
    const currentNonce = await this.getNonce(signer.address, provider);

    if (nonce !== currentNonce) {
      throw new Error(
        `Settlement nonce mismatch: response has ${nonce}, chain has ${currentNonce}. ` +
          `Did another settlement happen in between?`
      );
    }

    await this.settle(
      provider,
      requestHash,
      inputTokens,
      outputTokens,
      signature
    );
  }

  // ============ Utility Functions ============

  private requireSigner(): Wallet {
    if (!this.signer) {
      throw new Error('Signer required for this operation');
    }
    return this.signer;
  }

  /**
   * Get signer address
   */
  getAddress(): string | null {
    return this.signer?.address || null;
  }

  /**
   * Format wei to ETH
   */
  formatEther(wei: bigint): string {
    return formatEther(wei);
  }

  /**
   * Parse ETH to wei
   */
  parseEther(eth: string): bigint {
    return parseEther(eth);
  }
}

/**
 * Create SDK from environment
 */
export function createSDK(config: {
  rpcUrl: string;
  privateKey?: string;
  registryAddress: string;
  ledgerAddress: string;
  inferenceAddress: string;
}): JejuComputeSDK {
  return new JejuComputeSDK({
    rpcUrl: config.rpcUrl,
    signer: config.privateKey ? new Wallet(config.privateKey) : undefined,
    contracts: {
      registry: config.registryAddress,
      ledger: config.ledgerAddress,
      inference: config.inferenceAddress,
    },
  });
}
