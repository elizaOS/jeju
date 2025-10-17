/**
 * Betting Service
 * 
 * Connects to SEPARATE betting A2A server/contract
 * Handles bets independently from game-playing
 * 
 * KEY: Betting is a different A2A server with different skills!
 */

import { Service, type IAgentRuntime, logger } from '@elizaos/core';
import { A2AClientService } from './a2aClient.js';
import { GameDiscoveryService } from './gameDiscoveryService.js';

export interface BettingPosition {
  gameId: string;
  outcome: 'YES' | 'NO';
  amount: number;
  odds: number;
  timestamp: number;
}

export class BettingService extends Service {
  static serviceType = 'betting';
  capabilityDescription = 'Manages bets on prediction markets (separate from game-playing)';

  private bettingClient: A2AClientService | null = null;
  private positions: Map<string, BettingPosition> = new Map();

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('[Betting] Initializing betting service...');

    // Check if betting server is available
    const discovery = runtime.getService('game-discovery') as GameDiscoveryService;
    
    if (!discovery) {
      logger.warn('[Betting] No discovery service - betting disabled');
      return;
    }

    const bettingServer = discovery.getBettingServer();
    
    if (!bettingServer) {
      logger.info('[Betting] No betting server configured - betting disabled');
      logger.info('[Betting] Set BETTING_SERVER_URL to enable betting');
      return;
    }

    // Create separate A2A client for betting server
    this.bettingClient = new A2AClientService(runtime);
    await this.bettingClient.initialize(runtime, bettingServer.url);

    logger.info(`[Betting] ✅ Connected to: ${bettingServer.name}`);
    logger.info(`[Betting] ✅ Skills: ${this.bettingClient.getSkills().length}`);
  }

  /**
   * Place a bet (discovers the bet skill dynamically)
   */
  async placeBet(
    gameId: string,
    outcome: 'YES' | 'NO',
    amount: number
  ): Promise<{ success: boolean; message: string }> {
    if (!this.bettingClient) {
      return { success: false, message: 'Betting not available' };
    }

    // Dynamically find the betting skill
    const skills = this.bettingClient.getSkills();
    const betSkill = skills.find(
      s => s.id.includes('bet') || s.id.includes('place') || s.id.includes('wager')
    );

    if (!betSkill) {
      logger.error('[Betting] No betting skill found on betting server!');
      return { success: false, message: 'Betting skill not available' };
    }

    try {
      // Execute bet skill
      const result = await this.bettingClient.sendMessage(betSkill.id, {
        gameId,
        outcome,
        amount
      });

      const position: BettingPosition = {
        gameId,
        outcome,
        amount,
        odds: 0, // TODO: Extract from result
        timestamp: Date.now()
      };

      this.positions.set(gameId, position);

      logger.info(`[Betting] ✅ Bet placed: ${amount} on ${outcome} for game ${gameId}`);
      
      return { success: true, message: 'Bet placed' };
    } catch (error) {
      logger.error('[Betting] Failed to place bet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Bet failed'
      };
    }
  }

  /**
   * Get current positions
   */
  getPositions(): BettingPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get position for specific game
   */
  getPosition(gameId: string): BettingPosition | null {
    return this.positions.get(gameId) || null;
  }

  hasBettingEnabled(): boolean {
    return this.bettingClient !== null;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new BettingService(runtime);
    await service.initialize(runtime);
    return service;
  }

  async stop(): Promise<void> {
    logger.info('[Betting] Shutting down');
    if (this.bettingClient) {
      await this.bettingClient.cleanup();
    }
  }
}

