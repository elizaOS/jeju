/**
 * VibeVM Prediction Game Agents
 * 
 * Multi-agent setup for autonomous prediction market gameplay
 * Uses GENERIC plugin that discovers skills dynamically
 */

import { AgentRuntime, type Character, type Plugin } from '@elizaos/core';
import genericGamePlugin from './plugin.js';
import bootstrapPlugin from '@elizaos/plugin-bootstrap';
import openaiPlugin from '@elizaos/plugin-openai';
import sqlPlugin from '@elizaos/plugin-sql';

// Import characters
import analyst from '../characters/analyst.json';
import contrarian from '../characters/contrarian.json';
// TODO: Import remaining characters when created

const activeRuntimes: Map<string, AgentRuntime> = new Map();

async function createAgentRuntime(
  character: Character,
  privateKeyEnvVar: string
): Promise<AgentRuntime> {
  const privateKey = process.env[privateKeyEnvVar];
  if (!privateKey) {
    throw new Error(`Missing environment variable: ${privateKeyEnvVar}`);
  }

  const characterWithSettings: Character = {
    ...character,
    settings: {
      secrets: {
        // Game discovery
        GAME_SERVER_URL: process.env.GAME_SERVER_URL || 'http://localhost:8000',
        
        // Betting (SEPARATE server!)
        BETTING_SERVER_URL: process.env.BETTING_SERVER_URL || '',
        
        // Blockchain
        RPC_URL: process.env.RPC_URL || 'http://localhost:8545',
        REGISTRY_ADDRESS: process.env.REGISTRY_ADDRESS || '',
        
        // Agent identity
        AGENT_PRIVATE_KEY: privateKey,
      },
      
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      AGENT_AUTOPLAY: process.env.AGENT_AUTOPLAY || '1',
      ...character.settings,
    },
  };

  console.log(`\n🚀 Creating runtime for ${character.name}...`);
  console.log(`   Wallet: ${privateKey.substring(0, 10)}...`);

  // Create runtime with generic plugin
  const runtime = new AgentRuntime({
    character: characterWithSettings,
    plugins: [
      sqlPlugin as Plugin,
      bootstrapPlugin as Plugin,
      openaiPlugin as Plugin,
      genericGamePlugin
    ],
  });

  await runtime.initialize();

  console.log(`✅ ${character.name} initialized`);
  console.log(`   Agent will discover skills dynamically from A2A server`);

  return runtime;
}

async function startAgents(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║         🎮 VibeVM Prediction Game Agents Starting 🎮             ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  console.log('🔑 Configuration:');
  console.log(`   Game Server: ${process.env.GAME_SERVER_URL || 'Not set'}`);
  console.log(`   Betting Server: ${process.env.BETTING_SERVER_URL || 'Not set (betting disabled)'}`);
  console.log(`   RPC URL: ${process.env.RPC_URL || 'http://localhost:8545'}`);
  console.log(`   Auto-Play: ${process.env.AGENT_AUTOPLAY || '1'}\n`);

  const characters = [
    { character: analyst as unknown as Character, envVar: 'PLAYER1_PRIVATE_KEY' },
    { character: contrarian as unknown as Character, envVar: 'PLAYER2_PRIVATE_KEY' },
    // TODO: Add remaining characters
    // { character: insider as unknown as Character, envVar: 'PLAYER3_PRIVATE_KEY' },
    // { character: social as unknown as Character, envVar: 'PLAYER4_PRIVATE_KEY' },
    // { character: random as unknown as Character, envVar: 'PLAYER5_PRIVATE_KEY' },
  ];

  // Initialize all runtimes
  for (const { character, envVar } of characters) {
    const runtime = await createAgentRuntime(character, envVar);
    activeRuntimes.set(character.name, runtime);
  }

  console.log('\n✨ All agents running!');
  console.log(`📊 Active agents: ${activeRuntimes.size}`);
  console.log('\nAgents:');
  for (const [name, runtime] of activeRuntimes) {
    console.log(`  - ${name} (ID: ${runtime.agentId})`);
  }

  // Auto-shutdown
  const autoShutdownMs = parseInt(process.env.AUTO_SHUTDOWN_MS || '300000'); // 5 min default
  if (autoShutdownMs > 0) {
    console.log(`\n⏱️  Auto-shutdown: ${autoShutdownMs / 60000} minutes`);
    setTimeout(() => {
      console.log('\n⏰ Auto-shutdown triggered');
      process.exit(0);
    }, autoShutdownMs);
  } else {
    console.log('\n⏳ Agents active. Press Ctrl+C to stop.');
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down agents...');
  activeRuntimes.clear();
  process.exit(0);
});

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startAgents().catch(err => {
    console.error('❌ Failed to start agents:', err);
    process.exit(1);
  });
}

export { activeRuntimes, createAgentRuntime, startAgents, genericGamePlugin };

