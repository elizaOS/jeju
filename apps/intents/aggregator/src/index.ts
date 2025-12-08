/**
 * @fileoverview OIF Intent Aggregator
 * Main entry point for the A2A/MCP server with WebSocket support
 */

import express, { type Express } from 'express';
import cors from 'cors';
import { a2aRouter, A2A_AGENT_CARD } from './a2a-server';
import { mcpRouter } from './mcp-server';
import { apiRouter } from './api';
import { rateLimit, agentRateLimit, strictRateLimit } from './middleware/rate-limit';
import { getWebSocketServer, type IntentWebSocketServer } from './websocket';

const app: Express = express();
const PORT = process.env.AGGREGATOR_PORT || 4010;
const WS_PORT = process.env.AGGREGATOR_WS_PORT || 4012;

app.use(cors());
app.use(express.json());

// Apply rate limiting
app.use(rateLimit());

// Serve agent card at well-known endpoint
app.get('/.well-known/agent-card.json', (_req, res) => {
  res.json(A2A_AGENT_CARD);
});

// A2A JSON-RPC endpoint (with agent-specific rate limiting)
app.use('/a2a', agentRateLimit(), a2aRouter);

// MCP endpoint (with agent-specific rate limiting)
app.use('/mcp', agentRateLimit(), mcpRouter);

// REST API (write endpoints get stricter limits)
app.use('/api/intents', strictRateLimit());
app.use('/api', apiRouter);

// Health check with WebSocket status
app.get('/health', (_req, res) => {
  const wsServer = getWebSocketServer(Number(WS_PORT));
  res.json({ 
    status: 'ok', 
    service: 'intents-aggregator', 
    version: '1.0.0',
    wsClients: wsServer.getClientCount(),
  });
});

// Start WebSocket server
const wsServer = getWebSocketServer(Number(WS_PORT));

app.listen(PORT, () => {
  console.log(`🎯 Intent Aggregator running on http://localhost:${PORT}`);
  console.log(`   Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
  console.log(`   A2A Endpoint: http://localhost:${PORT}/a2a`);
  console.log(`   MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`   REST API: http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${WS_PORT}`);
});

export { app, wsServer };

