import { SolverAgent } from './agent';
import { LiquidityManager } from './liquidity';
import { EventMonitor } from './monitor';
import { StrategyEngine } from './strategy';

const isTestnet = process.env.NETWORK === 'testnet';

const TESTNET_CHAINS = [
  { chainId: 11155111, name: 'Sepolia', rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com' },
  { chainId: 84532, name: 'Base Sepolia', rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org' },
  { chainId: 421614, name: 'Arbitrum Sepolia', rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc' },
  { chainId: 11155420, name: 'Optimism Sepolia', rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL || 'https://sepolia.optimism.io' },
  { chainId: 420690, name: 'Jeju Testnet', rpcUrl: process.env.JEJU_TESTNET_RPC_URL || 'https://testnet-rpc.jeju.network' },
];

const MAINNET_CHAINS = [
  { chainId: 1, name: 'Ethereum', rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com' },
  { chainId: 8453, name: 'Base', rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org' },
  { chainId: 42161, name: 'Arbitrum', rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc' },
  { chainId: 10, name: 'Optimism', rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io' },
  { chainId: 420691, name: 'Jeju', rpcUrl: process.env.JEJU_RPC_URL || 'https://rpc.jeju.network' },
];

const SOLVER_CONFIG = {
  chains: isTestnet ? TESTNET_CHAINS : MAINNET_CHAINS,
  minProfitBps: 10,
  maxGasPrice: 100n * 10n ** 9n,
  maxExposurePerChain: '10000000000000000000',
  maxIntentSize: '5000000000000000000',
  minReputation: 80,
  intentCheckIntervalMs: 1000,
  liquidityRebalanceIntervalMs: 60000,
};

async function main() {
  console.log('🤖 Starting OIF Solver Agent...');

  const liquidityManager = new LiquidityManager(SOLVER_CONFIG);
  const strategyEngine = new StrategyEngine(SOLVER_CONFIG);
  const eventMonitor = new EventMonitor(SOLVER_CONFIG);
  const agent = new SolverAgent({ config: SOLVER_CONFIG, liquidityManager, strategyEngine, eventMonitor });

  await agent.start();

  console.log(`✅ Solver Agent running`);
  console.log(`   Chains: ${SOLVER_CONFIG.chains.map(c => c.name).join(', ')}`);
  console.log(`   Min Profit: ${SOLVER_CONFIG.minProfitBps} bps`);

  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down solver...');
    await agent.stop();
    process.exit(0);
  });
}

main().catch(console.error);

export { SolverAgent, LiquidityManager, EventMonitor, StrategyEngine, SOLVER_CONFIG };
