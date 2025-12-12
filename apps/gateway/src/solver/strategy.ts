import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { arbitrum, optimism, mainnet, sepolia } from 'viem/chains';
import { ZERO_ADDRESS } from '../lib/contracts.js';

interface StrategyConfig {
  minProfitBps: number;
  maxGasPrice: bigint;
  maxIntentSize: string;
}

interface IntentEvaluation {
  orderId: string;
  sourceChain: number;
  destinationChain: number;
  inputToken: string;
  inputAmount: string;
  outputToken: string;
  outputAmount: string;
}

interface EvaluationResult {
  profitable: boolean;
  expectedProfitBps: number;
  reason?: string;
  gasEstimate?: bigint;
}

const CHAINLINK_ETH_USD: Record<number, Address> = {
  1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  42161: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
  10: '0x13e3Ee699D1909E989722E753853AE30b17e08c5',
};

const AGGREGATOR_ABI = [{
  type: 'function',
  name: 'latestRoundData',
  inputs: [],
  outputs: [
    { name: 'roundId', type: 'uint80' },
    { name: 'answer', type: 'int256' },
    { name: 'startedAt', type: 'uint256' },
    { name: 'updatedAt', type: 'uint256' },
    { name: 'answeredInRound', type: 'uint80' },
  ],
  stateMutability: 'view',
}] as const;

const CHAINS = { 1: mainnet, 42161: arbitrum, 10: optimism, 11155111: sepolia } as const;
const FILL_GAS = 150000n;

let ethPrice = 0; // Updated by refreshPrices()

export class StrategyEngine {
  private config: StrategyConfig;
  private clients = new Map<number, PublicClient>();

  constructor(config: StrategyConfig) {
    this.config = config;
    for (const [id, chain] of Object.entries(CHAINS)) {
      const rpc = process.env[`${chain.name.toUpperCase().replace(/ /g, '_')}_RPC_URL`];
      this.clients.set(Number(id), createPublicClient({ chain, transport: http(rpc) }) as PublicClient);
    }
    this.refreshPrices();
    setInterval(() => this.refreshPrices(), 60000);
  }

  private async refreshPrices(): Promise<void> {
    const client = this.clients.get(1);
    const feed = CHAINLINK_ETH_USD[1];
    if (!client || !feed) return;

    const result = await client.readContract({ address: feed, abi: AGGREGATOR_ABI, functionName: 'latestRoundData' });
    if (result[1] > 0n) ethPrice = Number(result[1]) / 1e8;
  }

  async evaluate(intent: IntentEvaluation): Promise<EvaluationResult> {
    if (BigInt(intent.inputAmount) > BigInt(this.config.maxIntentSize)) {
      return { profitable: false, expectedProfitBps: 0, reason: 'Exceeds max size' };
    }

    const input = BigInt(intent.inputAmount);
    const output = BigInt(intent.outputAmount);
    const fee = input - output;
    if (fee <= 0n) return { profitable: false, expectedProfitBps: 0, reason: 'No fee' };

    const client = this.clients.get(intent.destinationChain);
    const gasPrice = client ? await client.getGasPrice() : this.config.maxGasPrice;
    if (gasPrice > this.config.maxGasPrice) {
      return { profitable: false, expectedProfitBps: 0, reason: 'Gas too high' };
    }

    const gasCost = FILL_GAS * gasPrice;
    const netProfit = fee - gasCost;
    if (netProfit <= 0n) return { profitable: false, expectedProfitBps: 0, reason: 'Gas exceeds fee', gasEstimate: gasCost };

    const profitBps = Number((netProfit * 10000n) / input);
    if (profitBps < this.config.minProfitBps) {
      return { profitable: false, expectedProfitBps: profitBps, reason: `${profitBps} bps < min ${this.config.minProfitBps}`, gasEstimate: gasCost };
    }

    return { profitable: true, expectedProfitBps: profitBps, gasEstimate: gasCost };
  }

  getEthPrice(): number {
    return ethPrice;
  }
}
