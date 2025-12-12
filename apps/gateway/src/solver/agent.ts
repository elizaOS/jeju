import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { LiquidityManager } from './liquidity';
import { StrategyEngine } from './strategy';
import { EventMonitor, type IntentEvent } from './monitor';
import { getChain } from '../lib/chains.js';
import { ZERO_ADDRESS } from '../lib/contracts.js';

function loadOutputSettlers(): Record<number, `0x${string}`> {
  const path = resolve(process.cwd(), '../../packages/config/contracts.json');
  if (!existsSync(path)) {
    console.warn('⚠️ contracts.json not found, no OutputSettlers loaded');
    return {};
  }
  
  const contracts = JSON.parse(readFileSync(path, 'utf-8'));
  const out: Record<number, `0x${string}`> = {};

  for (const chain of Object.values(contracts.external || {})) {
    const c = chain as { chainId?: number; oif?: { outputSettler?: string } };
    if (c.chainId && c.oif?.outputSettler) out[c.chainId] = c.oif.outputSettler as `0x${string}`;
  }
  for (const net of ['testnet', 'mainnet'] as const) {
    const cfg = contracts[net];
    if (cfg?.chainId && cfg?.oif?.outputSettler) out[cfg.chainId] = cfg.oif.outputSettler as `0x${string}`;
  }
  return out;
}

const OUTPUT_SETTLERS = loadOutputSettlers();

interface SolverConfig {
  chains: Array<{ chainId: number; name: string; rpcUrl: string }>;
  minProfitBps: number;
  maxGasPrice: bigint;
  maxIntentSize: string;
}

export class SolverAgent {
  private config: SolverConfig;
  private liquidity: LiquidityManager;
  private strategy: StrategyEngine;
  private monitor: EventMonitor;
  private clients = new Map<number, { public: PublicClient; wallet?: WalletClient }>();
  private pending = new Set<string>();
  private running = false;

  constructor(config: SolverConfig, liquidity: LiquidityManager, strategy: StrategyEngine, monitor: EventMonitor) {
    this.config = config;
    this.liquidity = liquidity;
    this.strategy = strategy;
    this.monitor = monitor;
  }

  async start(): Promise<void> {
    console.log('📡 Connecting to chains...');
    const pk = process.env.SOLVER_PRIVATE_KEY;

    for (const chain of this.config.chains) {
      const chainDef = getChain(chain.chainId);
      const pub = createPublicClient({ chain: chainDef, transport: http(chain.rpcUrl) });
      let wallet: WalletClient | undefined;
      if (pk) {
        const account = privateKeyToAccount(pk as `0x${string}`);
        wallet = createWalletClient({ account, chain: chainDef, transport: http(chain.rpcUrl) });
      }
      this.clients.set(chain.chainId, { public: pub, wallet });
      console.log(`   ✓ ${chain.name}`);
    }

    await this.liquidity.initialize(this.clients);
    this.monitor.on('intent', (e: IntentEvent) => this.handleIntent(e));
    await this.monitor.start(this.clients);
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.monitor.stop();
  }

  isRunning(): boolean {
    return this.running;
  }

  private async handleIntent(e: IntentEvent): Promise<void> {
    if (this.pending.has(e.orderId)) return;

    console.log(`\n🎯 Intent ${e.orderId.slice(0, 10)}... | ${e.sourceChain} → ${e.destinationChain}`);

    const eval_ = await this.strategy.evaluate({
      orderId: e.orderId,
      sourceChain: e.sourceChain,
      destinationChain: e.destinationChain,
      inputToken: e.inputToken,
      inputAmount: e.inputAmount,
      outputToken: e.outputToken,
      outputAmount: e.outputAmount,
    });

    if (!eval_.profitable) {
      console.log(`   ❌ ${eval_.reason}`);
      return;
    }
    console.log(`   ✅ Profitable: ${eval_.expectedProfitBps} bps`);

    if (!(await this.liquidity.hasLiquidity(e.destinationChain, e.outputToken, e.outputAmount))) {
      console.log('   ❌ Insufficient liquidity');
      return;
    }

    this.pending.add(e.orderId);
    const result = await this.fill(e);
    console.log(result.success ? `   ✅ Filled: ${result.txHash}` : `   ❌ ${result.error}`);
    this.pending.delete(e.orderId);
  }

  private async fill(e: IntentEvent): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const client = this.clients.get(e.destinationChain);
    if (!client?.wallet) return { success: false, error: 'No wallet' };

    const settler = OUTPUT_SETTLERS[e.destinationChain] || process.env[`OIF_OUTPUT_SETTLER_${e.destinationChain}`] as `0x${string}`;
    if (!settler) return { success: false, error: 'No OutputSettler' };

    const gasPrice = await client.public.getGasPrice();
    if (gasPrice > this.config.maxGasPrice) return { success: false, error: 'Gas too high' };

    const isNative = e.outputToken === ZERO_ADDRESS;
    const amount = BigInt(e.outputAmount);
    const chain = getChain(e.destinationChain);

    if (!isNative) {
      const approveTx = await client.wallet.writeContract({
        chain,
        account: client.wallet.account!,
        address: e.outputToken as `0x${string}`,
        abi: [{ type: 'function', name: 'approve', inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }] as const,
        functionName: 'approve',
        args: [settler, amount],
      });
      await client.public.waitForTransactionReceipt({ hash: approveTx });
    }

    const fillArgs = [e.orderId as `0x${string}`, e.recipient as `0x${string}`, e.outputToken as `0x${string}`, amount] as const;
    
    const fillTx = isNative
      ? await client.wallet.writeContract({
          chain,
          account: client.wallet.account!,
          address: settler,
          abi: [{ type: 'function', name: 'fill', inputs: [{ name: 'o', type: 'bytes32' }, { name: 'r', type: 'address' }, { name: 't', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [], stateMutability: 'payable' }] as const,
          functionName: 'fill',
          args: fillArgs,
          value: amount,
        })
      : await client.wallet.writeContract({
          chain,
          account: client.wallet.account!,
          address: settler,
          abi: [{ type: 'function', name: 'fill', inputs: [{ name: 'o', type: 'bytes32' }, { name: 'r', type: 'address' }, { name: 't', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' }] as const,
          functionName: 'fill',
          args: fillArgs,
        });

    const receipt = await client.public.waitForTransactionReceipt({ hash: fillTx });
    if (receipt.status === 'reverted') return { success: false, error: 'Reverted' };

    await this.liquidity.recordFill(e.destinationChain, e.outputToken, e.outputAmount);
    return { success: true, txHash: fillTx };
  }
}
