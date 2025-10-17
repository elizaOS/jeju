/**
 * A2A JSON-RPC Server for Prediction Game
 * Handles A2A protocol requests with signature verification
 */

import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from '../game/engine';
import { generateAgentCard } from './agentCard';
import { Outcome } from '../types';

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface A2AMessage {
  role: 'user' | 'agent';
  parts: Array<{ kind: string; text?: string; data?: Record<string, unknown> }>;
  messageId: string;
  kind: 'message';
}

const A2A_ERROR_CODES = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SIGNATURE_FAILED: -32001
};

export class A2AServer {
  private gameEngine: GameEngine;
  private serverUrl: string;
  private seenMessageIds: Set<string> = new Set();

  constructor(gameEngine: GameEngine, serverUrl: string) {
    this.gameEngine = gameEngine;
    this.serverUrl = serverUrl;
  }

  createRouter(): Router {
    const router = Router();

    // Agent Card
    router.get('/.well-known/agent-card.json', (req: Request, res: Response) => {
      res.json(generateAgentCard(this.serverUrl));
    });

    // A2A JSON-RPC endpoint
    router.post('/a2a', async (req: Request, res: Response) => {
      await this.handleRequest(req, res);
    });

    return router;
  }

  async handleRequest(req: Request, res: Response): Promise<void> {
    const request = req.body as JSONRPCRequest;

    // Validate JSON-RPC
    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      res.json(this.createError(request.id ?? null, A2A_ERROR_CODES.INVALID_REQUEST, 'Invalid JSON-RPC version'));
      return;
    }

    if (!request.method) {
      res.json(this.createError(request.id ?? null, A2A_ERROR_CODES.INVALID_REQUEST, 'Missing method'));
      return;
    }

    // Route to handler
    switch (request.method) {
      case 'message/send':
        await this.handleMessageSend(request, res, false);
        break;
      
      case 'message/stream':
        await this.handleMessageSend(request, res, true);
        break;
      
      default:
        res.json(this.createError(request.id ?? null, A2A_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${request.method}`));
    }
  }

  private async handleMessageSend(request: JSONRPCRequest, res: Response, streaming: boolean): Promise<void> {
    const params = request.params as { message?: A2AMessage };

    if (!params || !params.message) {
      res.json(this.createError(request.id ?? null, A2A_ERROR_CODES.INVALID_PARAMS, 'Missing message'));
      return;
    }

    const message = params.message;

    // Extract data part
    const dataPart = message.parts.find(p => p.kind === 'data');
    if (!dataPart || !dataPart.data) {
      res.json(this.createError(request.id ?? null, A2A_ERROR_CODES.INVALID_PARAMS, 'Missing data part'));
      return;
    }

    const data = dataPart.data;
    const skillId = data.skillId as string;
    const agentId = data.agentId as string;
    const agentAddress = data.agentAddress as string;
    const signature = data.signature as string;
    const timestamp = data.timestamp as number;

    // Verify signature
    const validation = await this.verifySignature(message.messageId, timestamp, skillId, data, signature, agentAddress);
    if (!validation.valid) {
      res.json(this.createError(request.id ?? null, A2A_ERROR_CODES.SIGNATURE_FAILED, validation.error || 'Signature verification failed'));
      return;
    }

    // Prevent replay attacks
    if (this.seenMessageIds.has(message.messageId)) {
      res.json(this.createError(request.id ?? null, A2A_ERROR_CODES.INVALID_REQUEST, 'Duplicate message ID'));
      return;
    }
    this.seenMessageIds.add(message.messageId);

    // Execute skill
    const result = await this.executeSkill(skillId, agentId, data);

    if (!result.success) {
      res.json(this.createError(request.id ?? null, A2A_ERROR_CODES.INTERNAL_ERROR, result.message));
      return;
    }

    // Return response
    const responseMessage: A2AMessage = {
      role: 'agent',
      parts: [
        { kind: 'text', text: result.message },
        ...(result.data ? [{ kind: 'data', data: result.data }] : [])
      ],
      messageId: uuidv4(),
      kind: 'message'
    };

    if (streaming) {
      this.setupSSE(res);
      res.write(`data: ${JSON.stringify(this.createSuccess(request.id ?? null, responseMessage))}\n\n`);
      // Keep connection open for game events
    } else {
      res.json(this.createSuccess(request.id ?? null, responseMessage));
    }
  }

  private async verifySignature(
    messageId: string,
    timestamp: number,
    skillId: string,
    data: Record<string, unknown>,
    signature: string,
    claimedAddress: string
  ): Promise<{ valid: boolean; error?: string }> {
    // Check timestamp
    const age = Date.now() - timestamp;
    if (age > 5 * 60 * 1000) {
      return { valid: false, error: 'Message too old' };
    }

    // Reconstruct signature payload (ONLY skill data, exclude auth fields)
    const { agentId: _, agentAddress: __, agentDomain: ___, playerName: ____, signature: _____, timestamp: ______, skillId: _______, ...skillData } = data;
    
    const payload = JSON.stringify({
      messageId,
      timestamp,
      skillId,
      data: skillData
    });

    // Verify signature
    try {
      const recoveredAddress = ethers.verifyMessage(payload, signature);
      
      if (recoveredAddress.toLowerCase() !== claimedAddress.toLowerCase()) {
        return { valid: false, error: `Signature mismatch: ${recoveredAddress} vs ${claimedAddress}` };
      }

      // TODO: Verify agent is registered in ERC-8004
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Signature verification failed: ${error}` };
    }
  }

  private async executeSkill(skillId: string, agentId: string, data: Record<string, unknown>): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
    const game = this.gameEngine.getCurrentGame();

    switch (skillId) {
      case 'join-game':
        const agent = {
          id: agentId,
          name: (data.playerName as string) || `Agent_${agentId.slice(0, 8)}`,
          type: 'ai' as const,
          reputation: 50,
          wins: 0
        };
        
        const joined = this.gameEngine.joinLobby(agent);
        
        return {
          success: joined,
          message: joined ? 'Joined game lobby' : 'Lobby is full',
          data: { playerId: agentId }
        };
      
      case 'leave-game':
        // TODO: Implement leave logic
        return { success: true, message: 'Left the game' };
      
      case 'get-status':
        if (!game) {
          return {
            success: true,
            message: 'No active game',
            data: { active: false, phase: 'lobby' }
          };
        }

        const agent_status = game.agents.find(a => a.id === agentId);
        const myBets = game.market.bets.filter(b => b.agentId === agentId);

        return {
          success: true,
          message: 'Status retrieved',
          data: {
            gameId: game.id,
            question: game.scenario.question,
            phase: game.phase,
            day: game.currentDay,
            bettingOpen: game.bettingOpen,
            market: {
              yesOdds: game.market.yesOdds,
              noOdds: game.market.noOdds
            },
            myBets: myBets.map(b => ({ outcome: b.outcome, amount: b.amount, odds: b.odds })),
            playerName: agent_status?.name,
            playerCount: game.agents.length
          }
        };
      
      case 'post-to-feed':
        const content = data.content as string || data.message as string;
        if (!content) {
          return { success: false, message: 'Missing content' };
        }

        if (!game) {
          return { success: false, message: 'No active game' };
        }

        const poster = game.agents.find(a => a.id === agentId);
        if (!poster) {
          return { success: false, message: 'Not in game' };
        }

        this.gameEngine.postToFeed({
          authorId: agentId,
          authorName: poster.name,
          content: content.slice(0, 280)
        });

        return { success: true, message: 'Posted to feed' };
      
      case 'send-dm':
        const to = data.to as string || data.targetId as string;
        const dmContent = data.content as string || data.message as string;
        
        if (!to || !dmContent) {
          return { success: false, message: 'Missing recipient or content' };
        }

        this.gameEngine.sendDirectMessage({ from: agentId, to, content: dmContent });
        return { success: true, message: 'DM sent' };
      
      case 'place-bet':
        const outcome = data.outcome as 'YES' | 'NO';
        const amount = data.amount as number;

        if (!outcome || !amount) {
          return { success: false, message: 'Missing outcome or amount' };
        }

        if (!game || !game.bettingOpen) {
          return { success: false, message: 'Betting is closed' };
        }

        // Convert string to Outcome enum
        const outcomeEnum = outcome === 'YES' ? Outcome.YES : outcome === 'NO' ? Outcome.NO : null;
        if (!outcomeEnum) {
          return { success: false, message: 'Invalid outcome' };
        }

        const betPlaced = this.gameEngine.placeBet(agentId, outcomeEnum, amount);
        
        return {
          success: betPlaced,
          message: betPlaced ? `Bet placed: ${amount} on ${outcome}` : 'Failed to place bet',
          data: betPlaced ? { market: game.market } : undefined
        };
      
      case 'get-feed':
        if (!game) {
          return { success: true, message: 'No active game', data: { posts: [] } };
        }

        const limit = (data.limit as number) || 50;
        const posts = game.feed.slice(-limit);

        return {
          success: true,
          message: `Retrieved ${posts.length} posts`,
          data: { posts }
        };
      
      case 'get-market':
        if (!game) {
          return { success: false, message: 'No active game' };
        }

        return {
          success: true,
          message: 'Market state retrieved',
          data: { market: game.market }
        };
      
      case 'get-npc-info':
        const npcId = data.npcId as string;
        if (!game || !npcId) {
          return { success: false, message: 'Missing NPC ID or no active game' };
        }

        const npc = game.scenario.npcs.find(n => n.id === npcId);
        if (!npc) {
          return { success: false, message: 'NPC not found' };
        }

        return {
          success: true,
          message: 'NPC info retrieved',
          data: {
            id: npc.id,
            name: npc.name,
            bio: npc.bio,
            role: npc.role,
            // Don't reveal tendsToBeTruthful - players must figure it out
          }
        };
      
      case 'analyze-sentiment':
        if (!game) {
          return { success: false, message: 'No active game' };
        }

        // Simple sentiment analysis
        const recentPosts = game.feed.slice(-20);
        let positiveCount = 0;
        let negativeCount = 0;

        for (const post of recentPosts) {
          const lower = post.content.toLowerCase();
          if (lower.match(/succeed|success|confident|ready|good|great/)) positiveCount++;
          if (lower.match(/fail|doom|problem|bad|trouble|cancel/)) negativeCount++;
        }

        const total = positiveCount + negativeCount;
        const sentiment = total === 0 ? 'neutral' : positiveCount > negativeCount ? 'positive' : 'negative';
        const confidence = total === 0 ? 0 : Math.max(positiveCount, negativeCount) / total;

        return {
          success: true,
          message: `Sentiment: ${sentiment} (${(confidence * 100).toFixed(0)}% confidence)`,
          data: { sentiment, confidence, positiveCount, negativeCount, total }
        };
      
      default:
        return { success: false, message: `Unknown skill: ${skillId}` };
    }
  }

  private setupSSE(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
  }

  private createSuccess(id: string | number | null, result: unknown): JSONRPCResponse {
    return { jsonrpc: '2.0', id, result };
  }

  private createError(id: string | number | null, code: number, message: string, data?: unknown): JSONRPCResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message, data }
    };
  }
}

