import type { PublicClient, WalletClient } from 'viem';
import { ZERO_ADDRESS } from '../lib/contracts.js';

interface LiquidityConfig {
  chains: Array<{ chainId: number; name: string }>;
}

export class LiquidityManager {
  private config: LiquidityConfig;
  private balances = new Map<number, Map<string, bigint>>();
  private locked = new Map<number, Map<string, bigint>>();

  constructor(config: LiquidityConfig) {
    this.config = config;
  }

  async initialize(clients: Map<number, { public: PublicClient; wallet?: WalletClient }>): Promise<void> {
    console.log('💰 Initializing liquidity...');
    for (const chain of this.config.chains) {
      const client = clients.get(chain.chainId);
      if (!client?.wallet?.account) continue;

      const balance = await client.public.getBalance({ address: client.wallet.account.address });
      this.balances.set(chain.chainId, new Map([[ZERO_ADDRESS, balance]]));
      this.locked.set(chain.chainId, new Map());
      console.log(`   ${chain.name}: ${(Number(balance) / 1e18).toFixed(4)} ETH`);
    }
  }

  async hasLiquidity(chainId: number, token: string, amount: string): Promise<boolean> {
    const available = this.balances.get(chainId)?.get(token.toLowerCase()) || 0n;
    const used = this.locked.get(chainId)?.get(token.toLowerCase()) || 0n;
    return (available - used) >= BigInt(amount);
  }

  async recordFill(chainId: number, token: string, amount: string): Promise<void> {
    const key = token.toLowerCase();
    const current = this.balances.get(chainId)?.get(key) || 0n;
    this.balances.get(chainId)?.set(key, current - BigInt(amount));
    console.log(`   💸 -${(Number(amount) / 1e18).toFixed(4)} on chain ${chainId}`);
  }
}
