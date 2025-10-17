import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { GameEngine } from './game/engine';
import { apiRouter } from './api/routes';
import { A2AServer } from './a2a/server';
import { MCPServer } from './mcp/server';
import { config } from './config';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Game Engine
const gameEngine = new GameEngine({
  gameDurationMs: config.gameDurationMs,
  maxPlayers: config.maxPlayers,
  minPlayers: config.minPlayers
});

// Set up broadcast functions after engine is created
gameEngine.setBroadcastFunctions(broadcast, sendToAgent);

// Initialize A2A Server
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${config.port}`;
const a2aServer = new A2AServer(gameEngine, SERVER_URL);

// Initialize MCP Server
const mcpServer = new MCPServer(gameEngine);

// WebSocket connection handling
const clients = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket, req) => {
  const agentId = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('agentId');
  
  if (!agentId) {
    ws.close(1008, 'Agent ID required');
    return;
  }

  console.log(`🔌 WebSocket connected: ${agentId}`);
  clients.set(agentId, ws);

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(agentId, message, ws);
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log(`🔌 WebSocket disconnected: ${agentId}`);
    clients.delete(agentId);
  });

  // Send initial state
  const currentGame = gameEngine.getCurrentGame();
  if (currentGame) {
    ws.send(JSON.stringify({
      type: 'game_state',
      data: {
        phase: currentGame.phase,
        day: currentGame.currentDay,
        market: currentGame.market,
        feed: currentGame.feed.slice(-50) // Last 50 posts
      }
    }));
  }
});

function handleWebSocketMessage(agentId: string, message: any, ws: WebSocket) {
  // Handle real-time game actions via WebSocket
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    
    case 'subscribe_feed':
      // Client wants real-time feed updates
      ws.send(JSON.stringify({ type: 'subscribed', channel: 'feed' }));
      break;
    
    default:
      ws.send(JSON.stringify({ error: 'Unknown message type' }));
  }
}

// Broadcast to all connected clients
export function broadcast(message: any) {
  const data = JSON.stringify(message);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

// Send to specific agent
export function sendToAgent(agentId: string, message: any) {
  const ws = clients.get(agentId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Serve static game UI
app.use(express.static('src/public'));

// A2A Protocol Routes
app.use(a2aServer.createRouter());

// MCP Protocol Routes
app.use(mcpServer.createRouter());

// API Routes
app.use('/api/v1', apiRouter(gameEngine));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'caliguland-game',
    currentGame: gameEngine.getCurrentGame() ? {
      id: gameEngine.getCurrentGame()!.id,
      phase: gameEngine.getCurrentGame()!.phase,
      day: gameEngine.getCurrentGame()!.currentDay,
      players: gameEngine.getCurrentGame()!.agents.length
    } : null
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'VibeVM Prediction Game',
    version: '0.1.0',
    description: 'ERC-8004 Social Prediction Game with TEE Integration',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      websocket: '/ws',
      docs: '/api/v1/docs'
    }
  });
});

// Start the game engine
gameEngine.start();

// Start server
server.listen(config.port, () => {
  console.log(`🎮 VibeVM Game Server listening on port ${config.port}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${config.port}/ws`);
  console.log(`🌐 HTTP API: http://localhost:${config.port}/api/v1`);
  console.log(`🎯 Game UI: http://localhost:${config.port}/index.html`);
  console.log(`⏱️  Game duration: ${config.gameDurationMs / 60000} minutes`);
  console.log(`👥 Players: ${config.minPlayers}-${config.maxPlayers}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  gameEngine.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

