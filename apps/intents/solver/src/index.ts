/**
 * @fileoverview OIF Solver Agent
 * Autonomous agent that monitors intents and fills them for profit
 * 
 * ## Architecture:
 * 1. Monitors InputSettler contracts for new intents
 * 2. Evaluates profitability based on fee and liquidity
 * 3. Claims profitable intents
 * 4. Executes fills on OutputSettler
 * 5. Claims settlement once attested
 */

import { SolverAgent } from './agent';
import { LiquidityManager } from './liquidity';
import { EventMonitor } from './monitor';
import { StrategyEngine } from './strategy';

const SOLVER_CONFIG = {
  // Supported chains
  chains: [
    { chainId: 8453, name: 'Base', rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org' },
    { chainId: 42161, name: 'Arbitrum', rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc' },
    { chainId: 10, name: 'Optimism', rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io' },
    { chainId: 420691, name: 'Jeju', rpcUrl: process.env.JEJU_RPC_URL || 'http://localhost:8545' },
  ],

  // Profitability thresholds
  minProfitBps: 10, // 0.1% minimum profit
  maxGasPrice: 100n * 10n ** 9n, // 100 gwei max

  // Risk management
  maxExposurePerChain: '10000000000000000000', // 10 ETH
  maxIntentSize: '5000000000000000000', // 5 ETH
  minReputation: 80,

  // Timing
  intentCheckIntervalMs: 1000,
  liquidityRebalanceIntervalMs: 60000,
};

async function main() {
  console.log('🤖 Starting OIF Solver Agent...');

  // Initialize components
  const liquidityManager = new LiquidityManager(SOLVER_CONFIG);
  const strategyEngine = new StrategyEngine(SOLVER_CONFIG);
  const eventMonitor = new EventMonitor(SOLVER_CONFIG);
  const agent = new SolverAgent({
    config: SOLVER_CONFIG,
    liquidityManager,
    strategyEngine,
    eventMonitor,
  });

  // Start agent
  await agent.start();

  console.log(`✅ Solver Agent running`);
  console.log(`   Chains: ${SOLVER_CONFIG.chains.map(c => c.name).join(', ')}`);
  console.log(`   Min Profit: ${SOLVER_CONFIG.minProfitBps} bps`);

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down solver...');
    await agent.stop();
    process.exit(0);
  });
}

main().catch(console.error);

