/**
 * @fileoverview MCP (Model Context Protocol) Server for OIF Aggregator
 * Exposes intent framework resources and tools for AI agent integration
 */

import express, { Request, Response } from 'express';
import { IntentService } from './services/intent-service';
import { RouteService } from './services/route-service';
import { SolverService } from './services/solver-service';

const router: express.Router = express.Router();

// Initialize services
const intentService = new IntentService();
const routeService = new RouteService();
const solverService = new SolverService();

// MCP Server Info
const MCP_SERVER_INFO = {
  name: 'jeju-intents',
  version: '1.0.0',
  description: 'Open Intents Framework - Cross-chain intent creation and tracking',
  capabilities: {
    resources: true,
    tools: true,
    prompts: false,
  },
};

// MCP Resources
const MCP_RESOURCES = [
  {
    uri: 'oif://routes',
    name: 'Intent Routes',
    description: 'All available cross-chain routes with statistics',
    mimeType: 'application/json',
  },
  {
    uri: 'oif://solvers',
    name: 'Active Solvers',
    description: 'All registered solvers with reputation and liquidity',
    mimeType: 'application/json',
  },
  {
    uri: 'oif://intents/recent',
    name: 'Recent Intents',
    description: 'Last 100 intents across all chains',
    mimeType: 'application/json',
  },
  {
    uri: 'oif://stats',
    name: 'OIF Statistics',
    description: 'Global intent framework statistics',
    mimeType: 'application/json',
  },
];

// MCP Tools
const MCP_TOOLS = [
  {
    name: 'create_intent',
    description: 'Create a cross-chain swap intent',
    inputSchema: {
      type: 'object',
      properties: {
        sourceChain: { type: 'number', description: 'Source chain ID' },
        destinationChain: { type: 'number', description: 'Destination chain ID' },
        sourceToken: { type: 'string', description: 'Source token address' },
        destinationToken: { type: 'string', description: 'Destination token address' },
        amount: { type: 'string', description: 'Amount to transfer (wei)' },
        recipient: { type: 'string', description: 'Recipient address on destination' },
        maxFee: { type: 'string', description: 'Maximum fee willing to pay (wei)' },
      },
      required: ['sourceChain', 'destinationChain', 'sourceToken', 'destinationToken', 'amount'],
    },
  },
  {
    name: 'get_quote',
    description: 'Get best price quote for an intent',
    inputSchema: {
      type: 'object',
      properties: {
        sourceChain: { type: 'number', description: 'Source chain ID' },
        destinationChain: { type: 'number', description: 'Destination chain ID' },
        sourceToken: { type: 'string', description: 'Source token address' },
        destinationToken: { type: 'string', description: 'Destination token address' },
        amount: { type: 'string', description: 'Amount to transfer (wei)' },
      },
      required: ['sourceChain', 'destinationChain', 'sourceToken', 'destinationToken', 'amount'],
    },
  },
  {
    name: 'track_intent',
    description: 'Track the status of an intent',
    inputSchema: {
      type: 'object',
      properties: {
        intentId: { type: 'string', description: 'Intent ID to track' },
      },
      required: ['intentId'],
    },
  },
  {
    name: 'list_routes',
    description: 'List all available cross-chain routes',
    inputSchema: {
      type: 'object',
      properties: {
        sourceChain: { type: 'number', description: 'Filter by source chain (optional)' },
        destinationChain: { type: 'number', description: 'Filter by destination chain (optional)' },
      },
    },
  },
  {
    name: 'list_solvers',
    description: 'List all active solvers',
    inputSchema: {
      type: 'object',
      properties: {
        chainId: { type: 'number', description: 'Filter by chain ID (optional)' },
        minReputation: { type: 'number', description: 'Minimum reputation score (optional)' },
      },
    },
  },
];

// Initialize endpoint (required by MCP)
router.post('/initialize', (_req: Request, res: Response) => {
  res.json({
    protocolVersion: '2024-11-05',
    serverInfo: MCP_SERVER_INFO,
    capabilities: MCP_SERVER_INFO.capabilities,
  });
});

// List resources
router.post('/resources/list', (_req: Request, res: Response) => {
  res.json({ resources: MCP_RESOURCES });
});

// Read resource
router.post('/resources/read', async (req: Request, res: Response) => {
  const { uri } = req.body;

  let contents: unknown;
  let mimeType = 'application/json';

  switch (uri) {
    case 'oif://routes':
      contents = await routeService.listRoutes();
      break;
    case 'oif://solvers':
      contents = await solverService.listSolvers();
      break;
    case 'oif://intents/recent':
      contents = await intentService.getRecentIntents(100);
      break;
    case 'oif://stats':
      contents = await intentService.getStats();
      break;
    default:
      return res.status(404).json({ error: 'Resource not found' });
  }

  res.json({
    contents: [
      {
        uri,
        mimeType,
        text: JSON.stringify(contents, null, 2),
      },
    ],
  });
});

// List tools
router.post('/tools/list', (_req: Request, res: Response) => {
  res.json({ tools: MCP_TOOLS });
});

// Call tool
router.post('/tools/call', async (req: Request, res: Response) => {
  const { name, arguments: args } = req.body;

  let result: unknown;
  let isError = false;

  switch (name) {
    case 'create_intent':
      result = await intentService.createIntent(args);
      break;
    case 'get_quote':
      result = await intentService.getQuotes(args);
      break;
    case 'track_intent':
      result = await intentService.getIntent(args.intentId);
      break;
    case 'list_routes':
      result = await routeService.listRoutes(args);
      break;
    case 'list_solvers':
      result = await solverService.listSolvers(args);
      break;
    default:
      result = { error: 'Tool not found' };
      isError = true;
  }

  res.json({
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
    isError,
  });
});

// GET / - Return MCP manifest (for discovery)
router.get('/', (_req: Request, res: Response) => {
  res.json({
    server: MCP_SERVER_INFO.name,
    version: MCP_SERVER_INFO.version,
    description: MCP_SERVER_INFO.description,
    resources: MCP_RESOURCES,
    tools: MCP_TOOLS,
    capabilities: MCP_SERVER_INFO.capabilities,
    endpoints: {
      initialize: 'POST /mcp/initialize',
      listResources: 'POST /mcp/resources/list',
      readResource: 'POST /mcp/resources/read',
      listTools: 'POST /mcp/tools/list',
      callTool: 'POST /mcp/tools/call',
    },
  });
});

// Health check for MCP
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', server: MCP_SERVER_INFO });
});

export { router as mcpRouter };

