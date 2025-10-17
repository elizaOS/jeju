import { v4 as uuidv4 } from 'uuid';
import {
  GameSession,
  GameScenario,
  GamePhase,
  Outcome,
  Agent,
  Post,
  MarketState,
  Bet
} from '../types';
import { ScenarioGenerator } from './scenarios';
import { dstackHelper } from '../utils/dstack';

export interface GameEngineConfig {
  gameDurationMs: number;
  maxPlayers: number;
  minPlayers: number;
}

export class GameEngine {
  private config: GameEngineConfig;
  private currentGame: GameSession | null = null;
  private lobbyAgents: Agent[] = [];
  private tickInterval: NodeJS.Timeout | null = null;
  private scenarioGenerator: ScenarioGenerator;
  private broadcastFn?: (message: any) => void;
  private sendToAgentFn?: (agentId: string, message: any) => void;

  constructor(config: GameEngineConfig) {
    this.config = config;
    this.scenarioGenerator = new ScenarioGenerator();
  }

  // Set broadcast functions (called from main server)
  setBroadcastFunctions(
    broadcast: (message: any) => void,
    sendToAgent: (agentId: string, message: any) => void
  ) {
    this.broadcastFn = broadcast;
    this.sendToAgentFn = sendToAgent;
  }

  private broadcast(message: any) {
    if (this.broadcastFn) {
      this.broadcastFn(message);
    }
  }

  private sendToAgent(agentId: string, message: any) {
    if (this.sendToAgentFn) {
      this.sendToAgentFn(agentId, message);
    }
  }

  start() {
    console.log('🎮 Game Engine started');
    // Check for game start every 10 seconds
    this.tickInterval = setInterval(() => this.tick(), 10000);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    console.log('🎮 Game Engine stopped');
  }

  private tick() {
    // Check if we should start a new game
    if (!this.currentGame && this.lobbyAgents.length >= this.config.minPlayers) {
      this.startNewGame();
    }

    // Update current game state
    if (this.currentGame && this.currentGame.phase !== GamePhase.ENDED) {
      this.updateGameState();
    }
  }

  private async startNewGame() {
    console.log(`🎲 Starting new game with ${this.lobbyAgents.length} players`);

    // Generate scenario
    const scenario = await this.scenarioGenerator.generate();

    // Create game session
    const session: GameSession = {
      id: uuidv4(),
      scenario,
      agents: [...this.lobbyAgents],
      phase: GamePhase.EARLY,
      currentDay: 1,
      startTime: new Date(),
      market: this.initializeMarket(),
      feed: [],
      directMessages: new Map(),
      groupChats: [],
      insiderClues: [],
      bettingOpen: true,
      revealed: false
    };

    this.currentGame = session;
    this.lobbyAgents = []; // Clear lobby

    // Post initial system messages
    this.postToFeed({
      authorId: 'SYSTEM',
      authorName: 'Game System',
      content: `🎮 Game Started! Question: ${scenario.question}`,
      isSystemMessage: true
    });

    this.postToFeed({
      authorId: 'SYSTEM',
      authorName: 'Game System',
      content: `📊 Initial odds: 50% YES / 50% NO. Place your bets!`,
      isSystemMessage: true
    });

    // Distribute insider clues randomly
    this.distributeInsiderClues();

    // Broadcast game start
    this.broadcast({
      type: 'game_started',
      data: {
        sessionId: session.id,
        question: scenario.question,
        description: scenario.description,
        npcs: scenario.npcs.map(npc => ({ id: npc.id, name: npc.name, bio: npc.bio })),
        players: session.agents.map(a => ({ id: a.id, name: a.name }))
      }
    });
  }

  private updateGameState() {
    if (!this.currentGame) return;

    const elapsed = Date.now() - this.currentGame.startTime.getTime();
    const progress = elapsed / this.config.gameDurationMs;
    
    // Calculate current in-game day (1-30)
    const newDay = Math.min(Math.floor(progress * 30) + 1, 30);
    
    if (newDay !== this.currentGame.currentDay) {
      this.currentGame.currentDay = newDay;
      this.onDayChange(newDay);
    }

    // Update game phase based on day
    if (newDay >= 1 && newDay <= 10) {
      this.currentGame.phase = GamePhase.EARLY;
    } else if (newDay >= 11 && newDay <= 20) {
      this.currentGame.phase = GamePhase.MID;
    } else if (newDay >= 21 && newDay <= 29) {
      this.currentGame.phase = GamePhase.LATE;
    } else if (newDay >= 30) {
      this.currentGame.phase = GamePhase.REVEAL;
      if (!this.currentGame.revealed) {
        this.revealOutcome();
      }
    }

    // Close betting at Day 29 end
    if (newDay >= 29 && this.currentGame.bettingOpen) {
      this.closeBetting();
    }
  }

  private onDayChange(day: number) {
    console.log(`📅 Day ${day} begins`);
    
    // Post day change to feed
    this.postToFeed({
      authorId: 'SYSTEM',
      authorName: 'Game System',
      content: `📅 Day ${day} begins`,
      isSystemMessage: true
    });

    // Process scheduled events for this day
    this.processScheduledEvents(day);

    this.broadcast({
      type: 'day_changed',
      data: { day, phase: this.currentGame!.phase }
    });
  }

  private processScheduledEvents(day: number) {
    if (!this.currentGame) return;

    const events = this.currentGame.scenario.timeline.filter(e => e.day === day);

    for (const event of events) {
      if (event.isPublic) {
        // Post to public feed
        this.postToFeed({
          authorId: event.author,
          authorName: this.getNPCName(event.author),
          content: event.content,
          isSystemMessage: event.type === 'system'
        });
      } else if (event.targetAgents) {
        // Send as DM to specific agents
        for (const agentId of event.targetAgents) {
          this.sendDirectMessage({
            from: event.author,
            to: agentId,
            content: event.content
          });
        }
      }
    }
  }

  private distributeInsiderClues() {
    if (!this.currentGame) return;

    // Randomly select 30% of players to receive insider clues
    const numInsiders = Math.max(1, Math.floor(this.currentGame.agents.length * 0.3));
    const shuffled = [...this.currentGame.agents].sort(() => Math.random() - 0.5);
    const selectedAgents = shuffled.slice(0, numInsiders);

    for (const agent of selectedAgents) {
      // Some get truthful clues, some get lies
      const isTruthful = Math.random() > 0.3; // 70% truthful, 30% lies
      
      const insiderNPC = this.currentGame.scenario.npcs.find(
        npc => npc.role === 'insider' && npc.tendsToBeTruthful === isTruthful
      );

      if (insiderNPC) {
        const clueContent = this.generateInsiderClue(
          this.currentGame.scenario.secretOutcome,
          isTruthful
        );

        this.sendDirectMessage({
          from: insiderNPC.id,
          to: agent.id,
          content: clueContent
        });

        this.currentGame.insiderClues.push({
          agentId: agent.id,
          npcId: insiderNPC.id,
          content: clueContent,
          isTruthful,
          deliveredAt: new Date(),
          gameDay: 1
        });
      }
    }
  }

  private generateInsiderClue(outcome: Outcome, isTruthful: boolean): string {
    if (isTruthful) {
      return outcome === Outcome.YES
        ? "Insider tip: The project is secretly on track. Everything's ready, just playing it safe publicly."
        : "Insider tip: Between you and me, this project is doomed. They're covering up major issues.";
    } else {
      // Opposite of truth
      return outcome === Outcome.YES
        ? "Insider tip: Don't believe the hype. This will fail spectacularly."
        : "Insider tip: I've seen the internals. Success is guaranteed, they're just pretending there are problems.";
    }
  }

  private closeBetting() {
    if (!this.currentGame) return;

    this.currentGame.bettingOpen = false;
    
    this.postToFeed({
      authorId: 'SYSTEM',
      authorName: 'Game System',
      content: '🔒 Betting is now CLOSED. Prepare for the final reveal!',
      isSystemMessage: true
    });

    this.broadcast({
      type: 'betting_closed',
      data: { finalOdds: this.currentGame.market }
    });
  }

  private async revealOutcome() {
    if (!this.currentGame) return;

    this.currentGame.revealed = true;
    this.currentGame.finalOutcome = this.currentGame.scenario.secretOutcome;

    // Post dramatic reveal
    const outcomeText = this.currentGame.scenario.secretOutcome === Outcome.YES
      ? '✅ The outcome is YES! The event succeeded!'
      : '❌ The outcome is NO! The event failed!';

    this.postToFeed({
      authorId: 'SYSTEM',
      authorName: 'Game System',
      content: `🎯 FINAL OUTCOME: ${outcomeText}`,
      isSystemMessage: true
    });

    // Calculate winners and payouts
    const result = this.calculateResults();

    // Post results to oracle (TEE integration)
    await this.publishToOracle(result);

    this.broadcast({
      type: 'game_ended',
      data: result
    });

    // Schedule game end
    setTimeout(() => {
      this.currentGame!.phase = GamePhase.ENDED;
      this.currentGame = null;
    }, 300000); // 5 minutes for debrief
  }

  private calculateResults() {
    if (!this.currentGame) throw new Error('No active game');

    const winners: string[] = [];
    const payouts: { [agentId: string]: number } = {};

    const correctOutcome = this.currentGame.scenario.secretOutcome;
    const correctBets = this.currentGame.market.bets.filter(
      b => b.outcome === correctOutcome
    );
    const incorrectBets = this.currentGame.market.bets.filter(
      b => b.outcome !== correctOutcome
    );

    const totalLost = incorrectBets.reduce((sum, b) => sum + b.amount, 0);
    const totalWon = correctBets.reduce((sum, b) => sum + b.amount, 0);

    if (totalWon > 0) {
      for (const bet of correctBets) {
        const profit = (bet.amount / totalWon) * totalLost;
        payouts[bet.agentId] = bet.amount + profit;
        if (!winners.includes(bet.agentId)) {
          winners.push(bet.agentId);
        }
      }
    }

    return {
      sessionId: this.currentGame.id,
      outcome: correctOutcome,
      winners,
      payouts,
      marketHistory: [this.currentGame.market],
      reputationChanges: {}
    };
  }

  private async publishToOracle(result: any) {
    try {
      // Use Dstack to sign and publish outcome
      const dstack = dstackHelper;
      
      // Create attestation data
      const attestationData = {
        sessionId: result.sessionId,
        outcome: result.outcome,
        timestamp: Date.now()
      };

      // Get quote from TEE
      const quote = await dstack.getQuote(JSON.stringify(attestationData));
      
      console.log('📜 Oracle result published with TEE attestation');
      console.log('Quote:', quote.quote.substring(0, 64) + '...');

      // TODO: Submit to on-chain oracle contract
      // This would call the Oracle smart contract with the outcome and proof
      
    } catch (error) {
      console.error('❌ Failed to publish to oracle:', error);
    }
  }

  // Public methods for API
  public joinLobby(agent: Agent): boolean {
    if (this.currentGame) {
      // Game in progress, add to next lobby
      if (this.lobbyAgents.length >= this.config.maxPlayers) {
        return false;
      }
      this.lobbyAgents.push(agent);
      return true;
    } else {
      // No game, start collecting for next
      if (this.lobbyAgents.length >= this.config.maxPlayers) {
        return false;
      }
      this.lobbyAgents.push(agent);
      console.log(`🎯 Agent ${agent.name} joined lobby (${this.lobbyAgents.length}/${this.config.minPlayers})`);
      return true;
    }
  }

  public getCurrentGame(): GameSession | null {
    return this.currentGame;
  }

  public postToFeed(post: Partial<Post>) {
    if (!this.currentGame) return;

    const fullPost: Post = {
      id: uuidv4(),
      authorId: post.authorId || 'UNKNOWN',
      authorName: post.authorName || 'Unknown',
      content: post.content || '',
      timestamp: new Date(),
      gameDay: this.currentGame.currentDay,
      isSystemMessage: post.isSystemMessage || false,
      replyTo: post.replyTo
    };

    this.currentGame.feed.push(fullPost);

    // Broadcast to all players
    this.broadcast({
      type: 'new_post',
      data: fullPost
    });
  }

  public sendDirectMessage(dm: { from: string; to: string; content: string }) {
    if (!this.currentGame) return;

    const message = {
      id: uuidv4(),
      from: dm.from,
      to: dm.to,
      content: dm.content,
      timestamp: new Date(),
      gameDay: this.currentGame.currentDay,
      encrypted: false
    };

    const key = [dm.from, dm.to].sort().join('-');
    const existing = this.currentGame.directMessages.get(key) || [];
    existing.push(message);
    this.currentGame.directMessages.set(key, existing);

    // Send to recipient
    this.sendToAgent(dm.to, {
      type: 'direct_message',
      data: message
    });
  }

  public placeBet(agentId: string, outcome: Outcome.YES | Outcome.NO, amount: number): boolean {
    if (!this.currentGame || !this.currentGame.bettingOpen) {
      return false;
    }

    const bet: Bet = {
      agentId,
      outcome,
      amount,
      timestamp: new Date(),
      gameDay: this.currentGame.currentDay,
      odds: outcome === Outcome.YES ? this.currentGame.market.yesOdds : this.currentGame.market.noOdds
    };

    this.currentGame.market.bets.push(bet);
    this.updateMarketOdds(outcome, amount);

    this.broadcast({
      type: 'market_update',
      data: this.currentGame.market
    });

    return true;
  }

  private initializeMarket(): MarketState {
    return {
      yesShares: 0,
      noShares: 0,
      yesOdds: 50,
      noOdds: 50,
      totalVolume: 0,
      bets: []
    };
  }

  private updateMarketOdds(outcome: Outcome.YES | Outcome.NO, amount: number) {
    if (!this.currentGame) return;

    const market = this.currentGame.market;
    
    // Simple AMM logic (constant product)
    if (outcome === Outcome.YES) {
      market.yesShares += amount;
    } else {
      market.noShares += amount;
    }

    market.totalVolume += amount;

    const total = market.yesShares + market.noShares;
    if (total > 0) {
      market.yesOdds = Math.round((market.yesShares / total) * 100);
      market.noOdds = Math.round((market.noShares / total) * 100);
    }
  }

  private getNPCName(npcId: string): string {
    if (!this.currentGame) return npcId;
    const npc = this.currentGame.scenario.npcs.find(n => n.id === npcId);
    return npc ? npc.name : npcId;
  }
}

