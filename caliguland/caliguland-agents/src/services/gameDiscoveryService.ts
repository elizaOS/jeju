/**
 * Game Discovery Service
 * 
 * Discovers A2A game servers via ERC-8004 registry or direct URL
 * KEY: This service has NO game-specific knowledge
 */

import { Service, type IAgentRuntime, logger } from '@elizaos/core';
import { ethers } from 'ethers';

export interface GameServerInfo {
  name: string;
  url: string;
  description: string;
  discoveryMethod: 'registry' | 'direct' | 'manual';
}

export class GameDiscoveryService extends Service {
  static serviceType = 'game-discovery';
  capabilityDescription = 'Discovers A2A game servers via registry or configuration';

  private gameServer: GameServerInfo | null = null;
  private bettingServer: GameServerInfo | null = null;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('[Discovery] Discovering game servers...');

    // Method 1: Direct URL (highest priority)
    const directGameUrl = runtime.getSetting('GAME_SERVER_URL');
    if (directGameUrl) {
      this.gameServer = await this.connectDirect(directGameUrl, 'game');
      logger.info(`[Discovery] ✅ Game server: ${this.gameServer.name} (direct)`);
    }

    const directBettingUrl = runtime.getSetting('BETTING_SERVER_URL');
    if (directBettingUrl) {
      this.bettingServer = await this.connectDirect(directBettingUrl, 'betting');
      logger.info(`[Discovery] ✅ Betting server: ${this.bettingServer.name} (direct)`);
    }

    // Method 2: Registry discovery (if no direct URL)
    if (!this.gameServer) {
      const registryAddress = runtime.getSetting('REGISTRY_ADDRESS');
      if (registryAddress) {
        this.gameServer = await this.discoverViaRegistry(runtime, registryAddress, 'game');
        if (this.gameServer) {
          logger.info(`[Discovery] ✅ Game server: ${this.gameServer.name} (registry)`);
        }
      }
    }

    // Validation
    if (!this.gameServer) {
      logger.warn('[Discovery] ⚠️  No game server discovered - agent will be idle');
      logger.warn('[Discovery] Set GAME_SERVER_URL or REGISTRY_ADDRESS');
    }
  }

  /**
   * Connect to a server directly via URL
   * Fetches Agent Card to get server name and description
   */
  private async connectDirect(url: string, type: 'game' | 'betting'): Promise<GameServerInfo> {
    try {
      // Fetch Agent Card
      const cardUrl = `${url}/.well-known/agent-card.json`;
      const response = await fetch(cardUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch Agent Card from ${cardUrl}: ${response.statusText}`);
      }

      const card = await response.json();

      return {
        name: card.name || `${type} Server`,
        url: card.url || url,
        description: card.description || '',
        discoveryMethod: 'direct'
      };
    } catch (error) {
      logger.error(`[Discovery] Failed to connect to ${url}:`, error);
      throw error;
    }
  }

  /**
   * Discover game servers via ERC-8004 registry
   * Looks for agents with specific metadata indicating they're game servers
   */
  private async discoverViaRegistry(
    runtime: IAgentRuntime,
    registryAddress: string,
    type: 'game' | 'betting'
  ): Promise<GameServerInfo | null> {
    try {
      logger.info(`[Discovery] Querying registry ${registryAddress} for ${type} servers...`);

      // TODO: Implement registry query
      // 1. Connect to IdentityRegistry contract
      // 2. Query for agents with metadata.type === 'game-server' or 'betting-server'
      // 3. Fetch Agent Cards from discovered servers
      // 4. Return the first valid one

      logger.warn('[Discovery] Registry discovery not yet implemented');
      return null;
    } catch (error) {
      logger.error('[Discovery] Registry query failed:', error);
      return null;
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getGameServer(): GameServerInfo | null {
    return this.gameServer;
  }

  getBettingServer(): GameServerInfo | null {
    return this.bettingServer;
  }

  hasGameServer(): boolean {
    return this.gameServer !== null;
  }

  hasBettingServer(): boolean {
    return this.bettingServer !== null;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new GameDiscoveryService(runtime);
    await service.initialize(runtime);
    return service;
  }

  async stop(): Promise<void> {
    logger.info('[Discovery] Shutting down');
  }
}

