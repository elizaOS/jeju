/**
 * Auto-Play Service
 * 
 * Autonomous gameplay using DISCOVERED skills
 * NO hardcoded game knowledge - adapts to any A2A game!
 * 
 * Strategy:
 * 1. Periodically call "get-status" skill (or similar)
 * 2. Parse available actions from status response
 * 3. Use simple heuristics to decide next action
 * 4. Execute via discovered skills
 * 
 * For prediction game specifically:
 * - Monitor feed for sentiment
 * - Track insider tips
 * - Calculate confidence
 * - Place bets when confident
 */

import { Service, type IAgentRuntime, logger } from '@elizaos/core';
import { A2AClientService } from './a2aClient.js';
import { BettingService } from './bettingService.js';

export class AutoPlayService extends Service {
  static serviceType = 'autoplay';
  capabilityDescription = 'Autonomous gameplay using dynamically discovered skills';

  private a2aClient: A2AClientService | null = null;
  private bettingService: BettingService | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private confidence: { yes: number; no: number } = { yes: 0, no: 0 };
  private hasBet: boolean = false;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    const enabled = (runtime.getSetting('AGENT_AUTOPLAY') || '0').toString();
    
    if (enabled === '0' || enabled.toLowerCase() === 'false') {
      logger.info('[AutoPlay] Disabled (set AGENT_AUTOPLAY=1 to enable)');
      return;
    }

    // Wait for dependencies
    const maxRetries = 20;
    for (let i = 0; i < maxRetries; i++) {
      this.a2aClient = runtime.getService('a2a-client') as A2AClientService;
      this.bettingService = runtime.getService('betting') as BettingService;
      
      if (this.a2aClient) break;
      
      await new Promise(r => setTimeout(r, 250));
    }

    if (!this.a2aClient) {
      logger.warn('[AutoPlay] A2A client not available');
      return;
    }

    logger.info('[AutoPlay] ✅ Enabled - starting autonomous gameplay');
    this.startLoop();
  }

  private startLoop(): void {
    if (this.tickTimer) return;

    this.tickTimer = setInterval(async () => {
      try {
        await this.tick();
      } catch (err) {
        logger.warn(`[AutoPlay] Tick error: ${String(err)}`);
      }
    }, 5000); // Tick every 5 seconds
  }

  private async tick(): Promise<void> {
    if (!this.a2aClient) return;

    // Dynamically find the status skill
    const skills = this.a2aClient.getSkills();
    const statusSkill = skills.find(s => 
      s.id.includes('status') || s.id.includes('state') || s.name.toLowerCase().includes('status')
    );

    if (!statusSkill) {
      logger.debug('[AutoPlay] No status skill found - skipping tick');
      return;
    }

    // Get current status
    const status = await this.a2aClient.sendMessage(statusSkill.id, {});
    const statusData = this.extractData(status);

    if (!statusData) return;

    // Generic game logic based on available skills
    await this.decideNextAction(statusData, skills);
  }

  private async decideNextAction(status: any, skills: any[]): Promise<void> {
    // For prediction games: analyze and bet
    if (this.isPredictionGame(skills)) {
      await this.handlePredictionGame(status, skills);
      return;
    }

    // For other games: use generic heuristics
    logger.debug('[AutoPlay] Generic game detected - using basic heuristics');
  }

  private isPredictionGame(skills: any[]): boolean {
    return skills.some(s => 
      s.id.includes('bet') || s.id.includes('predict') || s.id.includes('market')
    );
  }

  private async handlePredictionGame(status: any, skills: any[]): Promise<void> {
    // Analyze feed if available
    if (status.feed || status.recentFeed) {
      const sentiment = this.analyzeSentiment(status.feed || status.recentFeed);
      this.confidence[sentiment.prediction] += sentiment.strength;
    }

    // Check for insider messages
    if (status.dms || status.insiderTips) {
      // Weight heavily
      this.confidence.yes += 20; // Placeholder logic
    }

    // Place bet if confident and haven't bet yet
    if (!this.hasBet && (this.confidence.yes > 70 || this.confidence.no > 70)) {
      const outcome = this.confidence.yes > this.confidence.no ? 'YES' : 'NO';
      
      // Try to bet via betting service first
      if (this.bettingService && this.bettingService.hasBettingEnabled()) {
        const result = await this.bettingService.placeBet(
          status.gameId || 'current',
          outcome as any,
          500
        );
        
        if (result.success) {
          this.hasBet = true;
          logger.info(`[AutoPlay] ✅ Bet placed via BettingService: ${outcome}`);
        }
      } else {
        // Fallback: try to find bet skill in game server
        const betSkill = skills.find(s => s.id.includes('bet') || s.id.includes('place'));
        
        if (betSkill && this.a2aClient) {
          await this.a2aClient.sendMessage(betSkill.id, { outcome, amount: 500 });
          this.hasBet = true;
          logger.info(`[AutoPlay] ✅ Bet placed via game server: ${outcome}`);
        }
      }
    }

    // Post to feed occasionally
    if (Math.random() < 0.1) { // 10% chance per tick
      const postSkill = skills.find(s => s.id.includes('post') || s.id.includes('feed'));
      
      if (postSkill && this.a2aClient) {
        const thoughts = [
          'Analyzing the situation...',
          'Interesting developments',
          'Monitoring closely',
          'Gathering more data'
        ];
        
        const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
        await this.a2aClient.sendMessage(postSkill.id, { content: thought });
      }
    }
  }

  private analyzeSentiment(feed: any[]): { prediction: 'yes' | 'no'; strength: number } {
    if (!Array.isArray(feed)) return { prediction: 'yes', strength: 0 };

    let positive = 0;
    let negative = 0;

    for (const post of feed.slice(-10)) {
      const content = (post.content || '').toLowerCase();
      
      if (content.match(/succeed|success|yes|confident|ready|good/)) positive++;
      if (content.match(/fail|no|doom|problem|bad|cancel/)) negative++;
    }

    const total = positive + negative;
    if (total === 0) return { prediction: 'yes', strength: 0 };

    return {
      prediction: positive > negative ? 'yes' : 'no',
      strength: Math.abs(positive - negative) * 5
    };
  }

  private extractData(result: unknown): Record<string, unknown> | null {
    const r = result as any;
    
    // Try to extract data part
    if (r && Array.isArray(r.parts)) {
      const dataPart = r.parts.find((p: any) => p.kind === 'data');
      return dataPart?.data || null;
    }
    
    if (r?.kind === 'task' && r?.status?.message?.parts) {
      const dataPart = r.status.message.parts.find((p: any) => p.kind === 'data');
      return dataPart?.data || null;
    }
    
    return r;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new AutoPlayService(runtime);
    await service.initialize(runtime);
    return service;
  }

  async stop(): Promise<void> {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    logger.info('[AutoPlay] Stopped');
  }
}

