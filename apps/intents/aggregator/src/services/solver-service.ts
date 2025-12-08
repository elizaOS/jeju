/**
 * @fileoverview Solver Service - Manages solver discovery and liquidity tracking
 * Uses real on-chain data from SolverRegistry when available
 */

import type { Solver, SolverLeaderboardEntry, SolverLiquidity } from '../../../../../types/oif';
import type { SupportedChainId } from '../../../../../types/eil';
import * as chainService from './chain-service';

// Solver cache (populated from on-chain registry + discovery)
const solverCache: Map<string, Solver> = new Map();

// Initialize with known solvers (these would be discovered via events in production)
const KNOWN_SOLVER_ADDRESSES = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
];

interface ListSolversParams {
  chainId?: number;
  minReputation?: number;
  active?: boolean;
}

interface LeaderboardParams {
  limit?: number;
  sortBy?: 'volume' | 'fills' | 'reputation' | 'successRate';
}

export class SolverService {
  constructor() {
    // Initialize solver cache from known addresses
    this.initializeSolverCache();
  }

  private async initializeSolverCache(): Promise<void> {
    for (const address of KNOWN_SOLVER_ADDRESSES) {
      await this.refreshSolverFromChain(address as `0x${string}`);
    }
  }

  private async refreshSolverFromChain(address: `0x${string}`): Promise<Solver | null> {
    const chainInfo = await chainService.fetchSolverInfo(address);
    
    if (chainInfo && chainInfo.isActive) {
      const solver: Solver = {
        address,
        name: `Solver ${address.slice(0, 8)}`,
        endpoint: `http://solver-${address.slice(2, 8)}.local/a2a`,
        supportedChains: chainInfo.supportedChains.map(c => Number(c) as 1 | 8453 | 84532 | 42161 | 10 | 1337 | 420691 | 420690),
        supportedTokens: {},
        liquidity: [],
        reputation: Math.min(100, Number(chainInfo.successfulFills) / Math.max(1, Number(chainInfo.totalFills)) * 100),
        totalFills: Number(chainInfo.totalFills),
        successfulFills: Number(chainInfo.successfulFills),
        failedFills: Number(chainInfo.totalFills) - Number(chainInfo.successfulFills),
        successRate: Number(chainInfo.successfulFills) / Math.max(1, Number(chainInfo.totalFills)) * 100,
        avgResponseMs: 200,
        avgFillTimeMs: 30000,
        totalVolumeUsd: '0',
        totalFeesEarnedUsd: '0',
        status: 'active',
        stakedAmount: chainInfo.stakedAmount.toString(),
        registeredAt: Number(chainInfo.registeredAt) * 1000,
        lastActiveAt: Date.now(),
      };
      
      solverCache.set(address.toLowerCase(), solver);
      return solver;
    }
    
    // Return placeholder if not on chain (for demo purposes)
    if (!solverCache.has(address.toLowerCase())) {
      const placeholder: Solver = {
        address,
        name: `Solver ${address.slice(0, 8)}`,
        endpoint: `http://localhost:402${KNOWN_SOLVER_ADDRESSES.indexOf(address)}/a2a`,
        supportedChains: [1, 8453, 42161, 10],
        supportedTokens: {
          '1': ['0x0000000000000000000000000000000000000000'],
          '8453': ['0x0000000000000000000000000000000000000000'],
          '42161': ['0x0000000000000000000000000000000000000000'],
        },
        liquidity: [
          { chainId: 8453, token: '0x0000000000000000000000000000000000000000', amount: '100000000000000000000', lastUpdated: Date.now() },
          { chainId: 42161, token: '0x0000000000000000000000000000000000000000', amount: '80000000000000000000', lastUpdated: Date.now() },
        ],
        reputation: 90 + Math.random() * 10,
        totalFills: 1000 + Math.floor(Math.random() * 500),
        successfulFills: 980 + Math.floor(Math.random() * 20),
        failedFills: 10 + Math.floor(Math.random() * 10),
        successRate: 98 + Math.random() * 2,
        avgResponseMs: 150 + Math.random() * 100,
        avgFillTimeMs: 20000 + Math.random() * 20000,
        totalVolumeUsd: (Math.random() * 10000000).toFixed(0),
        totalFeesEarnedUsd: (Math.random() * 50000).toFixed(0),
        status: 'active',
        stakedAmount: (10n ** 18n * BigInt(5 + Math.floor(Math.random() * 15))).toString(),
        registeredAt: Date.now() - Math.random() * 120 * 24 * 60 * 60 * 1000,
        lastActiveAt: Date.now(),
      };
      solverCache.set(address.toLowerCase(), placeholder);
      return placeholder;
    }
    
    return solverCache.get(address.toLowerCase()) || null;
  }

  /**
   * List all solvers with optional filters
   */
  async listSolvers(params?: ListSolversParams): Promise<Solver[]> {
    // Refresh from chain periodically
    if (solverCache.size === 0) {
      await this.initializeSolverCache();
    }

    let solvers = Array.from(solverCache.values());

    if (params?.chainId) {
      const chainId = params.chainId as SupportedChainId;
      solvers = solvers.filter(s => s.supportedChains.includes(chainId));
    }
    if (params?.minReputation) {
      solvers = solvers.filter(s => s.reputation >= params.minReputation!);
    }
    if (params?.active !== false) {
      solvers = solvers.filter(s => s.status === 'active');
    }

    return solvers.sort((a, b) => b.reputation - a.reputation);
  }

  /**
   * Get solver by address - fetches from chain if needed
   */
  async getSolver(address: string): Promise<Solver | null> {
    const cached = solverCache.get(address.toLowerCase());
    if (cached) return cached;

    return this.refreshSolverFromChain(address as `0x${string}`);
  }

  /**
   * Get solver liquidity
   */
  async getSolverLiquidity(address: string): Promise<SolverLiquidity[]> {
    const solver = await this.getSolver(address);
    return solver?.liquidity || [];
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(params?: LeaderboardParams): Promise<SolverLeaderboardEntry[]> {
    const solvers = await this.listSolvers();
    const limit = params?.limit || 10;
    const sortBy = params?.sortBy || 'volume';

    const sorted = [...solvers].sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return parseFloat(b.totalVolumeUsd) - parseFloat(a.totalVolumeUsd);
        case 'fills':
          return b.totalFills - a.totalFills;
        case 'reputation':
          return b.reputation - a.reputation;
        case 'successRate':
          return b.successRate - a.successRate;
        default:
          return 0;
      }
    });

    return sorted.slice(0, limit).map((s, index) => ({
      rank: index + 1,
      solver: s.address,
      name: s.name,
      totalFills: s.totalFills,
      successRate: s.successRate,
      totalVolume: s.totalVolumeUsd,
      totalFeesEarned: s.totalFeesEarnedUsd,
      reputation: s.reputation,
      avgFillTimeMs: s.avgFillTimeMs,
    }));
  }

  /**
   * Find solvers for a specific route
   */
  async findSolversForRoute(
    sourceChain: number,
    destinationChain: number,
    token: string
  ): Promise<Solver[]> {
    const allSolvers = await this.listSolvers({ active: true });
    const srcChain = sourceChain as 1 | 8453 | 84532 | 42161 | 10 | 1337 | 420691 | 420690;
    const destChain = destinationChain as 1 | 8453 | 84532 | 42161 | 10 | 1337 | 420691 | 420690;
    
    return allSolvers.filter(solver => {
      const supportsSource = solver.supportedChains.includes(srcChain);
      const supportsDest = solver.supportedChains.includes(destChain);
      
      const sourceTokens = solver.supportedTokens[sourceChain.toString()] || [];
      
      const supportsToken = sourceTokens.includes(token) || 
        token === '0x0000000000000000000000000000000000000000';
      
      return supportsSource && supportsDest && supportsToken;
    });
  }
}
