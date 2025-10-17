import { Router, Request, Response } from 'express';
import { GameEngine } from '../game/engine';
import {
  JoinGameRequest,
  PostMessageRequest,
  SendDMRequest,
  PlaceBetRequest,
  CreateGroupChatRequest,
  Agent
} from '../types';

export function apiRouter(gameEngine: GameEngine): Router {
  const router = Router();

  /**
   * POST /join - Join the game lobby
   */
  router.post('/join', (req: Request, res: Response) => {
    try {
      const { agentId, signature } = req.body as JoinGameRequest;

      // TODO: Verify agent signature/credentials via ERC-8004

      const agent: Agent = {
        id: agentId,
        name: `Agent_${agentId.slice(0, 8)}`, // TODO: Get from registry
        type: 'human', // TODO: Detect from agent metadata
        reputation: 50, // TODO: Fetch from on-chain registry
        wins: 0 // TODO: Fetch from registry
      };

      const joined = gameEngine.joinLobby(agent);

      if (joined) {
        res.json({
          success: true,
          message: 'Joined game lobby',
          agentId: agent.id
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Game lobby is full'
        });
      }
    } catch (error) {
      console.error('Join error:', error);
      res.status(500).json({ error: 'Failed to join game' });
    }
  });

  /**
   * GET /game - Get current game state
   */
  router.get('/game', (req: Request, res: Response) => {
    const game = gameEngine.getCurrentGame();
    
    if (!game) {
      return res.json({
        active: false,
        message: 'No active game. Join lobby to start a new one.'
      });
    }

    // Return sanitized game state (hide secret outcome)
    res.json({
      active: true,
      sessionId: game.id,
      question: game.scenario.question,
      description: game.scenario.description,
      phase: game.phase,
      day: game.currentDay,
      market: game.market,
      bettingOpen: game.bettingOpen,
      players: game.agents.map(a => ({
        id: a.id,
        name: a.name,
        reputation: a.reputation
      })),
      npcs: game.scenario.npcs.map(npc => ({
        id: npc.id,
        name: npc.name,
        bio: npc.bio
      }))
    });
  });

  /**
   * GET /feed - Get public feed
   */
  router.get('/feed', (req: Request, res: Response) => {
    const game = gameEngine.getCurrentGame();
    
    if (!game) {
      return res.json({ posts: [] });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const posts = game.feed.slice(-limit);

    res.json({ posts });
  });

  /**
   * POST /post - Post to public feed
   */
  router.post('/post', (req: Request, res: Response) => {
    try {
      const { agentId, content, replyTo } = req.body as PostMessageRequest;

      // TODO: Verify agent is in current game

      const game = gameEngine.getCurrentGame();
      if (!game) {
        return res.status(400).json({ error: 'No active game' });
      }

      const agent = game.agents.find(a => a.id === agentId);
      if (!agent) {
        return res.status(403).json({ error: 'Agent not in game' });
      }

      gameEngine.postToFeed({
        authorId: agentId,
        authorName: agent.name,
        content: content.slice(0, 280), // Enforce character limit
        replyTo
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Post error:', error);
      res.status(500).json({ error: 'Failed to post' });
    }
  });

  /**
   * POST /dm - Send direct message
   */
  router.post('/dm', (req: Request, res: Response) => {
    try {
      const { from, to, content } = req.body as SendDMRequest;

      const game = gameEngine.getCurrentGame();
      if (!game) {
        return res.status(400).json({ error: 'No active game' });
      }

      gameEngine.sendDirectMessage({ from, to, content });

      res.json({ success: true });
    } catch (error) {
      console.error('DM error:', error);
      res.status(500).json({ error: 'Failed to send DM' });
    }
  });

  /**
   * GET /dm/:agentId - Get DMs for an agent
   */
  router.get('/dm/:agentId', (req: Request, res: Response) => {
    const game = gameEngine.getCurrentGame();
    
    if (!game) {
      return res.json({ messages: [] });
    }

    const { agentId } = req.params;
    const messages: any[] = [];

    // Collect all DMs involving this agent
    game.directMessages.forEach((msgs, key) => {
      if (key.includes(agentId)) {
        messages.push(...msgs);
      }
    });

    res.json({ messages: messages.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    )});
  });

  /**
   * POST /bet - Place a bet
   */
  router.post('/bet', (req: Request, res: Response) => {
    try {
      const { agentId, outcome, amount } = req.body as PlaceBetRequest;

      const game = gameEngine.getCurrentGame();
      if (!game) {
        return res.status(400).json({ error: 'No active game' });
      }

      if (!game.bettingOpen) {
        return res.status(400).json({ error: 'Betting is closed' });
      }

      const placed = gameEngine.placeBet(agentId, outcome, amount);

      if (placed) {
        res.json({
          success: true,
          market: game.market
        });
      } else {
        res.status(400).json({ error: 'Failed to place bet' });
      }
    } catch (error) {
      console.error('Bet error:', error);
      res.status(500).json({ error: 'Failed to place bet' });
    }
  });

  /**
   * GET /market - Get current market state
   */
  router.get('/market', (req: Request, res: Response) => {
    const game = gameEngine.getCurrentGame();
    
    if (!game) {
      return res.json({ error: 'No active game' });
    }

    res.json(game.market);
  });

  /**
   * POST /group - Create group chat
   */
  router.post('/group', (req: Request, res: Response) => {
    try {
      const { agentId, name, members } = req.body as CreateGroupChatRequest;

      // TODO: Implement group chat creation
      
      res.json({
        success: true,
        groupId: 'placeholder'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create group' });
    }
  });

  /**
   * GET /docs - API documentation
   */
  router.get('/docs', (req: Request, res: Response) => {
    res.json({
      name: 'VibeVM Prediction Game API',
      version: '0.1.0',
      endpoints: {
        'POST /join': 'Join the game lobby',
        'GET /game': 'Get current game state',
        'GET /feed': 'Get public feed posts',
        'POST /post': 'Post to public feed',
        'POST /dm': 'Send direct message',
        'GET /dm/:agentId': 'Get DMs for agent',
        'POST /bet': 'Place a bet',
        'GET /market': 'Get market state',
        'POST /group': 'Create group chat'
      },
      websocket: {
        endpoint: '/ws?agentId=<your-agent-id>',
        events: ['game_started', 'day_changed', 'new_post', 'direct_message', 'market_update', 'betting_closed', 'game_ended']
      }
    });
  });

  return router;
}

