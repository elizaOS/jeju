/**
 * Web3 Service
 * Manages wallet and ERC-8004 registration
 * COPIED from Among Us, works generically for any game
 */

import { Service, type IAgentRuntime, logger } from '@elizaos/core';
import { ethers, Wallet, Contract, JsonRpcProvider } from 'ethers';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AgentInfo {
  agentId: bigint;
  agentAddress: string;
  agentDomain: string;
  isRegistered: boolean;
}

export class Web3Service extends Service {
  static serviceType = 'web3';
  capabilityDescription = 'Manages wallet and ERC-8004 registration';

  private wallet: Wallet | null = null;
  private provider: JsonRpcProvider | null = null;
  private identityContract: Contract | null = null;
  private agentInfo: AgentInfo | null = null;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    const rpcUrl = runtime.getSetting('RPC_URL') || 'http://localhost:8545';
    const privateKey = runtime.getSetting('AGENT_PRIVATE_KEY');

    if (!privateKey) {
      throw new Error('AGENT_PRIVATE_KEY not configured');
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);

    logger.info(`[Web3] Wallet: ${this.wallet.address}`);

    // Load ERC-8004 contracts (try multiple paths)
    const possiblePaths = [
      join(__dirname, '../../../../cicero/contracts'),  // From jeju root
      join(__dirname, '../../../contracts'),            // From caliguland
      join(__dirname, '../../contracts')                // Fallback
    ];

    let addresses: any = null;
    let abi: any = null;

    for (const basePath of possiblePaths) {
      try {
        const addressPath = join(basePath, 'IdentityRegistry.json');
        addresses = JSON.parse(readFileSync(addressPath, 'utf-8'));
        abi = addresses.abi;
        break;
      } catch {
        continue;
      }
    }

    if (!addresses || !abi) {
      logger.warn('[Web3] ERC-8004 contracts not found - using mock registration');
      this.agentInfo = {
        agentId: BigInt(Math.floor(Math.random() * 1000)),
        agentAddress: this.wallet.address,
        agentDomain: this.generateDomain(runtime),
        isRegistered: true
      };
      logger.info('[Web3] ✅ Mock registration (for testing without contracts)');
      return;
    }

    this.identityContract = new Contract(
      addresses.address || addresses.identityRegistry,
      abi,
      this.wallet
    );

    await this.ensureRegistered(runtime);
  }

  private async ensureRegistered(runtime: IAgentRuntime): Promise<void> {
    const domain = this.generateDomain(runtime);
    
    logger.info(`[Web3] Checking registration...`);

    const result = await this.identityContract!.resolveAgentByAddress(this.wallet!.address);

    if (result.agentId_ !== 0n) {
      this.agentInfo = {
        agentId: result.agentId_,
        agentAddress: this.wallet!.address,
        agentDomain: result.agentDomain_,
        isRegistered: true
      };

      logger.info('[Web3] ✅ Already registered');
      logger.info(`[Web3]    ID: ${this.agentInfo.agentId}`);
      logger.info(`[Web3]    Domain: ${this.agentInfo.agentDomain}`);
    } else {
      logger.info('[Web3] Registering new agent...');

      const tx = await this.identityContract!.newAgent(domain, this.wallet!.address);
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log: ethers.Log) => {
          return this.identityContract!.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
        })
        .find((e: ethers.LogDescription | null) => e?.name === 'AgentRegistered');

      this.agentInfo = {
        agentId: event!.args.agentId,
        agentAddress: this.wallet!.address,
        agentDomain: domain,
        isRegistered: true
      };

      logger.info('[Web3] ✅ Registered');
      logger.info(`[Web3]    ID: ${this.agentInfo.agentId}`);
      logger.info(`[Web3]    Domain: ${this.agentInfo.agentDomain}`);
      logger.info(`[Web3]    TX: ${receipt.hash}`);
    }
  }

  private generateDomain(runtime: IAgentRuntime): string {
    const name = runtime.character.name.toLowerCase().replace(/\s+/g, '-');
    const suffix = Math.random().toString(36).substring(7);
    return `${name}-${suffix}.caliguland.local`;
  }

  getAgentInfo(): AgentInfo | null {
    return this.agentInfo;
  }

  getWalletAddress(): string {
    return this.wallet?.address || '';
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new Web3Service(runtime);
    await service.initialize(runtime);
    return service;
  }

  async stop(): Promise<void> {
    logger.info('[Web3] Shutting down');
  }
}

