/**
 * Real Blockchain Client
 *
 * Connects to actual EVM chain and interacts with deployed contracts.
 * Uses viem for type-safe contract interaction.
 */

import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  parseAbi,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { localhost, mainnet, sepolia } from 'viem/chains';

// Contract ABI (simplified - full ABI would be generated from Solidity)
const GAME_TREASURY_ABI = parseAbi([
  // Read functions
  'function getBalance() view returns (uint256)',
  'function isOperatorActive() view returns (bool)',
  'function currentStateCID() view returns (string)',
  'function currentStateHash() view returns (bytes32)',
  'function stateVersion() view returns (uint256)',
  'function keyVersion() view returns (uint256)',
  'function lastHeartbeat() view returns (uint256)',
  'function operator() view returns (address)',
  'function trainingEpoch() view returns (uint256)',
  'function getGameState() view returns (string, bytes32, uint256, uint256, uint256, bool)',
  'function getOperatorInfo() view returns (address, bytes, uint256, bool)',

  // Write functions (operator)
  'function updateState(string cid, bytes32 hash)',
  'function heartbeat()',
  'function recordTraining(string datasetCID, bytes32 modelHash)',
  'function withdraw(uint256 amount)',

  // Write functions (council)
  'function registerOperator(address operator, bytes attestation)',
  'function initiateKeyRotation()',
  'function pause()',
  'function unpause()',

  // Write functions (admin)
  'function setDailyLimit(uint256 newLimit)',
  'function addCouncilMember(address member)',

  // Funding
  'function deposit() payable',

  // Events
  'event OperatorRegistered(address indexed operator, bytes attestation)',
  'event StateUpdated(string cid, bytes32 hash, uint256 version)',
  'event HeartbeatReceived(address indexed operator, uint256 timestamp)',
  'event FundsWithdrawn(address indexed operator, uint256 amount)',
  'event FundsDeposited(address indexed depositor, uint256 amount)',
  'event KeyRotationInitiated(uint256 newVersion, address indexed initiator)',
  'event TrainingRecorded(uint256 epoch, string datasetCID, bytes32 modelHash)',
]);

export type ChainId = 'mainnet' | 'sepolia' | 'localhost';

export interface BlockchainConfig {
  chainId: ChainId;
  rpcUrl?: string;
  contractAddress: Address;
  privateKey?: Hex; // For operator/council transactions
}

export interface GameState {
  cid: string;
  hash: Hex;
  version: bigint;
  keyVersion: bigint;
  lastHeartbeat: bigint;
  operatorActive: boolean;
}

export interface OperatorInfo {
  address: Address;
  attestation: Hex;
  registeredAt: bigint;
  active: boolean;
}

function getChain(chainId: ChainId): Chain {
  switch (chainId) {
    case 'mainnet':
      return mainnet;
    case 'sepolia':
      return sepolia;
    case 'localhost':
      return localhost;
  }
}

/**
 * Client for interacting with the GameTreasury contract
 */
export class BlockchainClient {
  private config: BlockchainConfig;
  private chain: Chain;
  private account: ReturnType<typeof privateKeyToAccount> | null = null;

  constructor(config: BlockchainConfig) {
    this.config = config;
    this.chain = getChain(config.chainId);

    if (config.privateKey) {
      this.account = privateKeyToAccount(config.privateKey);
    }
  }

  private getPublicClient() {
    return createPublicClient({
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });
  }

  private getWalletClient() {
    if (!this.account) {
      throw new Error('Wallet not configured - provide privateKey');
    }
    return createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });
  }

  // =========================================================================
  // Read Functions
  // =========================================================================

  async getBalance(): Promise<bigint> {
    const client = this.getPublicClient();
    return client.readContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'getBalance',
    });
  }

  async isOperatorActive(): Promise<boolean> {
    const client = this.getPublicClient();
    return client.readContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'isOperatorActive',
    });
  }

  async getGameState(): Promise<GameState> {
    const client = this.getPublicClient();
    const result = await client.readContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'getGameState',
    });

    const [cid, hash, version, keyVersion, lastHeartbeat, operatorActive] =
      result as [string, Hex, bigint, bigint, bigint, boolean];

    return {
      cid,
      hash,
      version,
      keyVersion,
      lastHeartbeat,
      operatorActive,
    };
  }

  async getOperatorInfo(): Promise<OperatorInfo> {
    const client = this.getPublicClient();
    const result = await client.readContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'getOperatorInfo',
    });

    const [address, attestation, registeredAt, active] = result as [
      Address,
      Hex,
      bigint,
      boolean,
    ];

    return { address, attestation, registeredAt, active };
  }

  async getKeyVersion(): Promise<bigint> {
    const client = this.getPublicClient();
    return client.readContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'keyVersion',
    });
  }

  async getTrainingEpoch(): Promise<bigint> {
    const client = this.getPublicClient();
    return client.readContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'trainingEpoch',
    });
  }

  // =========================================================================
  // Write Functions (Operator)
  // =========================================================================

  async updateState(cid: string, hash: Hex): Promise<Hex> {
    const client = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const txHash = await client.writeContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'updateState',
      args: [cid, hash],
      chain: this.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  async heartbeat(): Promise<Hex> {
    const client = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const txHash = await client.writeContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'heartbeat',
      chain: this.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  async recordTraining(datasetCID: string, modelHash: Hex): Promise<Hex> {
    const client = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const txHash = await client.writeContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'recordTraining',
      args: [datasetCID, modelHash],
      chain: this.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  async withdraw(amountEth: string): Promise<Hex> {
    const client = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const txHash = await client.writeContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'withdraw',
      args: [parseEther(amountEth)],
      chain: this.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  // =========================================================================
  // Write Functions (Council)
  // =========================================================================

  async registerOperator(
    operatorAddress: Address,
    attestation: Hex
  ): Promise<Hex> {
    const client = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const txHash = await client.writeContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'registerOperator',
      args: [operatorAddress, attestation],
      chain: this.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  async initiateKeyRotation(): Promise<Hex> {
    const client = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const txHash = await client.writeContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'initiateKeyRotation',
      chain: this.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  // =========================================================================
  // Funding
  // =========================================================================

  async deposit(amountEth: string): Promise<Hex> {
    const client = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const txHash = await client.writeContract({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      functionName: 'deposit',
      value: parseEther(amountEth),
      chain: this.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  // =========================================================================
  // Event Watching
  // =========================================================================

  watchStateUpdates(
    callback: (cid: string, hash: Hex, version: bigint) => void
  ): () => void {
    const client = this.getPublicClient();
    const unwatch = client.watchContractEvent({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      eventName: 'StateUpdated',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as { cid: string; hash: Hex; version: bigint };
          callback(args.cid, args.hash, args.version);
        }
      },
    });

    return unwatch;
  }

  watchKeyRotations(callback: (newVersion: bigint) => void): () => void {
    const client = this.getPublicClient();
    const unwatch = client.watchContractEvent({
      address: this.config.contractAddress,
      abi: GAME_TREASURY_ABI,
      eventName: 'KeyRotationInitiated',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as { newVersion: bigint };
          callback(args.newVersion);
        }
      },
    });

    return unwatch;
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  getAddress(): Address | null {
    return this.account?.address ?? null;
  }

  getContractAddress(): Address {
    return this.config.contractAddress;
  }
}
