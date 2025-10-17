/**
 * MCP (Model Context Protocol) Server for Prediction Game
 * Exposes game actions as MCP tools for AI agents
 */

import { Router, Request, Response } from 'express';
import { GameEngine } from '../game/engine';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    tools: boolean;
    prompts: boolean;
    resources: boolean;
  };
}

export class MCPServer {
  private gameEngine: GameEngine;

  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine;
  }

  createRouter(): Router {
    const router = Router();

    // MCP Server Info
    router.get('/mcp', (req: Request, res: Response) => {
      const info: MCPServerInfo = {
        name: 'VibeVM Prediction Game',
        version: '0.1.0',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: true,
          prompts: true,
          resources: true
        }
      };
      res.json(info);
    });

    // List tools
    router.post('/mcp/tools/list', (req: Request, res: Response) => {
      res.json({
        tools: this.getTools()
      });
    });

    // Call tool
    router.post('/mcp/tools/call', async (req: Request, res: Response) => {
      const { name, arguments: args } = req.body;
      
      try {
        const result = await this.executeTool(name, args || {});
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: {
            code: 'TOOL_EXECUTION_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    });

    // List prompts
    router.post('/mcp/prompts/list', (req: Request, res: Response) => {
      res.json({
        prompts: [
          {
            name: 'analyze-game',
            description: 'Analyze the current game state and suggest a strategy',
            arguments: [{ name: 'agentId', description: 'Your agent ID', required: true }]
          },
          {
            name: 'sentiment-summary',
            description: 'Get a summary of feed sentiment and market confidence',
            arguments: []
          }
        ]
      });
    });

    // Get prompt
    router.post('/mcp/prompts/get', async (req: Request, res: Response) => {
      const { name, arguments: args } = req.body;
      
      try {
        const prompt = await this.getPrompt(name, args || {});
        res.json(prompt);
      } catch (error) {
        res.status(500).json({
          error: {
            code: 'PROMPT_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    });

    return router;
  }

  private getTools(): MCPTool[] {
    return [
      {
        name: 'join_game',
        description: 'Join the prediction game lobby',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Your agent ID' },
            playerName: { type: 'string', description: 'Display name' }
          },
          required: ['agentId']
        }
      },
      {
        name: 'get_game_status',
        description: 'Get current game state, question, market odds, and your position',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Your agent ID' }
          },
          required: ['agentId']
        }
      },
      {
        name: 'post_to_feed',
        description: 'Post a message to the public feed (max 280 chars)',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string' },
            content: { type: 'string', description: 'Message content (max 280 chars)' }
          },
          required: ['agentId', 'content']
        }
      },
      {
        name: 'place_bet',
        description: 'Place a bet on YES or NO outcome',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string' },
            outcome: { type: 'string', enum: ['YES', 'NO'] },
            amount: { type: 'number', description: 'Bet amount' }
          },
          required: ['agentId', 'outcome', 'amount']
        }
      },
      {
        name: 'send_dm',
        description: 'Send a private message to another player',
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Your agent ID' },
            to: { type: 'string', description: 'Recipient agent ID' },
            content: { type: 'string', description: 'Message content' }
          },
          required: ['from', 'to', 'content']
        }
      },
      {
        name: 'analyze_sentiment',
        description: 'Get AI sentiment analysis of recent feed posts',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_market_state',
        description: 'Get current betting odds and market statistics',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const game = this.gameEngine.getCurrentGame();

    switch (name) {
      case 'join_game':
        const agent = {
          id: args.agentId as string,
          name: (args.playerName as string) || `Agent_${(args.agentId as string).slice(0, 8)}`,
          type: 'ai' as const,
          reputation: 50,
          wins: 0
        };
        
        const joined = this.gameEngine.joinLobby(agent);
        return { joined, message: joined ? 'Joined lobby' : 'Lobby full' };
      
      case 'get_game_status':
        if (!game) {
          return { active: false, message: 'No active game' };
        }

        const agentId = args.agentId as string;
        const myBets = game.market.bets.filter(b => b.agentId === agentId);
        
        return {
          active: true,
          gameId: game.id,
          question: game.scenario.question,
          description: game.scenario.description,
          phase: game.phase,
          day: game.currentDay,
          bettingOpen: game.bettingOpen,
          market: game.market,
          myBets,
          recentFeed: game.feed.slice(-10)
        };
      
      case 'post_to_feed':
        if (!game) {
          return { success: false, error: 'No active game' };
        }

        const poster = game.agents.find(a => a.id === args.agentId as string);
        if (!poster) {
          return { success: false, error: 'Not in game' };
        }

        this.gameEngine.postToFeed({
          authorId: args.agentId as string,
          authorName: poster.name,
          content: (args.content as string).slice(0, 280)
        });

        return { success: true, message: 'Posted' };
      
      case 'place_bet':
        if (!game || !game.bettingOpen) {
          return { success: false, error: 'Betting closed' };
        }

        const placed = this.gameEngine.placeBet(
          args.agentId as string,
          args.outcome as any,
          args.amount as number
        );

        return {
          success: placed,
          market: game.market
        };
      
      case 'send_dm':
        this.gameEngine.sendDirectMessage({
          from: args.from as string,
          to: args.to as string,
          content: args.content as string
        });
        return { success: true };
      
      case 'analyze_sentiment':
        if (!game) {
          return { error: 'No active game' };
        }

        const posts = game.feed.slice(-20);
        let positive = 0, negative = 0;

        for (const post of posts) {
          const lower = post.content.toLowerCase();
          if (lower.match(/succeed|success|yes|good/)) positive++;
          if (lower.match(/fail|no|bad|doom/)) negative++;
        }

        return {
          sentiment: positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral',
          confidence: (Math.max(positive, negative) / (positive + negative || 1)),
          positive,
          negative
        };
      
      case 'get_market_state':
        if (!game) {
          return { error: 'No active game' };
        }

        return { market: game.market };
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getPrompt(name: string, args: Record<string, unknown>): Promise<unknown> {
    const game = this.gameEngine.getCurrentGame();

    switch (name) {
      case 'analyze-game':
        if (!game) {
          return { messages: [{ role: 'user', content: { type: 'text', text: 'No active game' } }] };
        }

        const agentId = args.agentId as string;
        const myBets = game.market.bets.filter(b => b.agentId === agentId);
        const recentPosts = game.feed.slice(-10);

        const analysis = `
GAME ANALYSIS FOR ${agentId}

Question: ${game.scenario.question}
Current Day: ${game.currentDay}/30
Phase: ${game.phase}
Betting: ${game.bettingOpen ? 'OPEN' : 'CLOSED'}

MARKET STATE:
- YES odds: ${game.market.yesOdds}%
- NO odds: ${game.market.noOdds}%
- Total volume: ${game.market.totalVolume}

YOUR POSITION:
${myBets.length > 0 ? myBets.map(b => `- ${b.outcome}: ${b.amount} tokens at ${b.odds}% odds`).join('\n') : '- No bets placed yet'}

RECENT FEED (last 10 posts):
${recentPosts.map(p => `[Day ${p.gameDay}] ${p.authorName}: ${p.content}`).join('\n')}

RECOMMENDATION:
${this.generateRecommendation(game, myBets)}
`;

        return {
          messages: [
            { role: 'user', content: { type: 'text', text: analysis } }
          ]
        };
      
      case 'sentiment-summary':
        if (!game) {
          return { messages: [{ role: 'user', content: { type: 'text', text: 'No active game' } }] };
        }

        const sentiment = this.analyzeSentiment(game.feed);

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Feed Sentiment: ${sentiment.sentiment}\nConfidence: ${(sentiment.confidence * 100).toFixed(0)}%\nMarket: YES ${game.market.yesOdds}% / NO ${game.market.noOdds}%`
              }
            }
          ]
        };
      
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  private generateRecommendation(game: any, myBets: any[]): string {
    if (!game.bettingOpen) {
      return 'Betting is closed. Wait for outcome reveal.';
    }

    if (myBets.length > 0) {
      return 'You have already placed bets. Monitor the feed for new information.';
    }

    if (game.currentDay < 10) {
      return 'Early game - gather more information before betting heavily.';
    }

    if (game.market.yesOdds > 70) {
      return 'Market heavily favors YES. Consider if consensus is correct or overconfident.';
    }

    if (game.market.noOdds > 70) {
      return 'Market heavily favors NO. Look for contrarian signals if you disagree.';
    }

    return 'Market is uncertain. Look for insider tips and NPC credibility signals.';
  }

  private analyzeSentiment(feed: any[]): { sentiment: string; confidence: number } {
    let positive = 0, negative = 0;

    for (const post of feed.slice(-20)) {
      const lower = post.content.toLowerCase();
      if (lower.match(/succeed|success|yes|confident|ready/)) positive++;
      if (lower.match(/fail|no|doom|problem|cancel/)) negative++;
    }

    const total = positive + negative;
    return {
      sentiment: total === 0 ? 'neutral' : positive > negative ? 'positive' : 'negative',
      confidence: total === 0 ? 0 : Math.max(positive, negative) / total
    };
  }
}

