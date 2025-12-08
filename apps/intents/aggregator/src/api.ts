/**
 * @fileoverview REST API for OIF Aggregator
 * Standard HTTP endpoints for intent operations
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

// ============ Intent Endpoints ============

// Create intent
router.post('/intents', async (req: Request, res: Response) => {
  const { sourceChain, destinationChain, sourceToken, destinationToken, amount } = req.body;
  
  if (!sourceChain || !destinationChain || !sourceToken || !destinationToken || !amount) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['sourceChain', 'destinationChain', 'sourceToken', 'destinationToken', 'amount'],
    });
  }
  
  const intent = await intentService.createIntent(req.body);
  res.json(intent);
});

// Get intent by ID
router.get('/intents/:intentId', async (req: Request, res: Response) => {
  const intent = await intentService.getIntent(req.params.intentId);
  if (!intent) {
    return res.status(404).json({ error: 'Intent not found' });
  }
  res.json(intent);
});

// List intents (with optional filters)
router.get('/intents', async (req: Request, res: Response) => {
  const { user, status, sourceChain, destinationChain, limit } = req.query;
  const intents = await intentService.listIntents({
    user: user as string,
    status: status as string,
    sourceChain: sourceChain ? Number(sourceChain) : undefined,
    destinationChain: destinationChain ? Number(destinationChain) : undefined,
    limit: limit ? Number(limit) : 50,
  });
  res.json(intents);
});

// Cancel intent
router.post('/intents/:intentId/cancel', async (req: Request, res: Response) => {
  const { user } = req.body;
  if (!user) {
    return res.status(400).json({ error: 'User address required' });
  }
  const result = await intentService.cancelIntent(req.params.intentId, user);
  res.json(result);
});

// Get quote for intent
router.post('/intents/quote', async (req: Request, res: Response) => {
  const { sourceChain, destinationChain, sourceToken, destinationToken, amount } = req.body;
  
  if (!sourceChain || !destinationChain || !sourceToken || !destinationToken || !amount) {
    return res.status(400).json({ 
      error: 'Missing required fields', 
      required: ['sourceChain', 'destinationChain', 'sourceToken', 'destinationToken', 'amount'] 
    });
  }
  
  const quotes = await intentService.getQuotes(req.body);
  res.json(quotes);
});

// ============ Route Endpoints ============

// List all routes
router.get('/routes', async (req: Request, res: Response) => {
  const { sourceChain, destinationChain, active } = req.query;
  const routes = await routeService.listRoutes({
    sourceChain: sourceChain ? Number(sourceChain) : undefined,
    destinationChain: destinationChain ? Number(destinationChain) : undefined,
    active: active !== undefined ? active === 'true' : undefined,
  });
  res.json(routes);
});

// Get specific route
router.get('/routes/:routeId', async (req: Request, res: Response) => {
  const route = await routeService.getRoute(req.params.routeId);
  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.json(route);
});

// Get best route for swap
router.post('/routes/best', async (req: Request, res: Response) => {
  const route = await routeService.getBestRoute(req.body);
  res.json(route);
});

// Get route volume
router.get('/routes/:routeId/volume', async (req: Request, res: Response) => {
  const volume = await routeService.getVolume({
    routeId: req.params.routeId,
    period: (req.query.period as '24h' | '7d' | '30d' | 'all') || '24h',
  });
  res.json(volume);
});

// ============ Solver Endpoints ============

// Solver leaderboard (MUST be before :address route)
router.get('/solvers/leaderboard', async (req: Request, res: Response) => {
  const { limit, sortBy } = req.query;
  const validSortBy = ['volume', 'fills', 'reputation', 'successRate'];
  const sort = sortBy && validSortBy.includes(sortBy as string) 
    ? sortBy as 'volume' | 'fills' | 'reputation' | 'successRate' 
    : 'volume';
  const leaderboard = await solverService.getLeaderboard({
    limit: limit ? Number(limit) : 20,
    sortBy: sort,
  });
  res.json(leaderboard);
});

// List all solvers
router.get('/solvers', async (req: Request, res: Response) => {
  const { chainId, minReputation, active } = req.query;
  const solvers = await solverService.listSolvers({
    chainId: chainId ? Number(chainId) : undefined,
    minReputation: minReputation ? Number(minReputation) : undefined,
    active: active !== 'false',
  });
  res.json(solvers);
});

// Get solver liquidity (MUST be before :address route)
router.get('/solvers/:address/liquidity', async (req: Request, res: Response) => {
  const liquidity = await solverService.getSolverLiquidity(req.params.address);
  res.json(liquidity);
});

// Get specific solver (catch-all for addresses)
router.get('/solvers/:address', async (req: Request, res: Response) => {
  const solver = await solverService.getSolver(req.params.address);
  if (!solver) {
    return res.status(404).json({ error: 'Solver not found' });
  }
  res.json(solver);
});

// ============ Stats Endpoints ============

// Global stats
router.get('/stats', async (_req: Request, res: Response) => {
  const stats = await intentService.getStats();
  res.json(stats);
});

// Stats by chain
router.get('/stats/chain/:chainId', async (req: Request, res: Response) => {
  const stats = await intentService.getChainStats(Number(req.params.chainId));
  res.json(stats);
});

// ============ Config Endpoints ============

// Get supported chains
router.get('/config/chains', (_req: Request, res: Response) => {
  const chains = routeService.getChains();
  res.json(chains);
});

// Get supported tokens
router.get('/config/tokens', (req: Request, res: Response) => {
  const { chainId } = req.query;
  if (chainId) {
    const tokens = routeService.getTokens(Number(chainId));
    res.json(tokens);
  } else {
    // Return all tokens for all chains
    const chains = routeService.getChains();
    const allTokens = chains.map(c => ({
      chainId: c.chainId,
      chainName: c.name,
      tokens: routeService.getTokens(c.chainId),
    }));
    res.json(allTokens);
  }
});

export { router as apiRouter };
