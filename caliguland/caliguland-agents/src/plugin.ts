/**
 * Generic A2A Game Plugin for ElizaOS
 * 
 * KEY DESIGN: This plugin has NO hardcoded game knowledge!
 * - Discovers game skills dynamically from A2A Agent Card
 * - Works with ANY A2A-compliant game server
 * - Separates game-playing from betting
 * - Can connect to multiple A2A servers (game + betting)
 */

import type { Plugin } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { Web3Service } from './services/web3Service.js';
import { A2AClientService } from './services/a2aClient.js';
import { GameDiscoveryService } from './services/gameDiscoveryService.js';
import { BettingService } from './services/bettingService.js';
import { AutoPlayService } from './services/autoPlayService.js';
import { z } from 'zod';

// ============================================================================
// Configuration Schema
// ============================================================================

const configSchema = z.object({
  // ERC-8004 Registry for discovering games
  REGISTRY_ADDRESS: z
    .string()
    .optional()
    .describe('ERC-8004 IdentityRegistry contract address'),
  
  // RPC for blockchain
  RPC_URL: z
    .string()
    .url()
    .default('http://localhost:8545')
    .describe('Ethereum RPC URL'),
  
  // Agent wallet (per-agent via runtime settings)
  AGENT_PRIVATE_KEY: z
    .string()
    .min(64)
    .optional()
    .describe('Private key for agent wallet'),
  
  // Optional: Direct game server URL (bypasses registry discovery)
  GAME_SERVER_URL: z
    .string()
    .url()
    .optional()
    .describe('Direct A2A game server URL (optional - will use registry if not provided)'),
  
  // Optional: Direct betting server URL (separate from game)
  BETTING_SERVER_URL: z
    .string()
    .url()
    .optional()
    .describe('A2A betting server URL (separate from game server)'),
  
  // Auto-play mode
  AGENT_AUTOPLAY: z
    .string()
    .optional()
    .default('0')
    .describe('Enable autonomous gameplay (0=off, 1=on)')
});

// ============================================================================
// Plugin Definition
// ============================================================================

const genericGamePlugin: Plugin = {
  name: 'generic-a2a-game',
  description: 'Generic A2A game plugin - discovers and plays any A2A game dynamically without hardcoded knowledge',
  
  async init(config: Record<string, string>) {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🎮 Generic A2A Game Plugin Initializing');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Merge config with environment
    const mergedConfig = {
      REGISTRY_ADDRESS: process.env.REGISTRY_ADDRESS || config.REGISTRY_ADDRESS,
      RPC_URL: process.env.RPC_URL || config.RPC_URL,
      AGENT_PRIVATE_KEY: process.env.AGENT_PRIVATE_KEY || config.AGENT_PRIVATE_KEY,
      GAME_SERVER_URL: process.env.GAME_SERVER_URL || config.GAME_SERVER_URL,
      BETTING_SERVER_URL: process.env.BETTING_SERVER_URL || config.BETTING_SERVER_URL,
      AGENT_AUTOPLAY: process.env.AGENT_AUTOPLAY || config.AGENT_AUTOPLAY
    };

    // Validate
    const validatedConfig = await configSchema.parseAsync(mergedConfig);

    // Set environment (except private key - that's per-agent)
    for (const [key, value] of Object.entries(validatedConfig)) {
      if (!value || key === 'AGENT_PRIVATE_KEY') continue;
      process.env[key] = value;
    }

    logger.info('✅ Configuration loaded');
    logger.info(`   RPC: ${validatedConfig.RPC_URL}`);
    
    if (validatedConfig.GAME_SERVER_URL) {
      logger.info(`   Game Server: ${validatedConfig.GAME_SERVER_URL} (direct)`);
    } else if (validatedConfig.REGISTRY_ADDRESS) {
      logger.info(`   Game Discovery: via registry ${validatedConfig.REGISTRY_ADDRESS}`);
    } else {
      logger.warn('   ⚠️  No game server or registry configured - agent will need manual connection');
    }
    
    if (validatedConfig.BETTING_SERVER_URL) {
      logger.info(`   Betting Server: ${validatedConfig.BETTING_SERVER_URL}`);
    }
    
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  },

  // Services initialize in order:
  // 1. Web3Service - Setup wallet, register on ERC-8004
  // 2. GameDiscoveryService - Find games via registry OR connect to direct URL
  // 3. A2AClientService - Connect to discovered game, fetch Agent Card, load skills dynamically
  // 4. BettingService - Connect to betting server (SEPARATE from game)
  // 5. AutoPlayService - Autonomous gameplay using discovered skills
  services: [
    Web3Service,
    GameDiscoveryService,
    A2AClientService,
    BettingService,
    AutoPlayService
  ],

  // NO hardcoded actions! 
  // Actions are dynamically registered by A2AClientService after discovering skills
  actions: [],
  
  // NO hardcoded providers!
  // Providers are dynamically registered based on game type
  providers: [],

  // NO hardcoded evaluators!
  // Evaluators can be added by game-specific logic if needed
  evaluators: []
};

export default genericGamePlugin;

