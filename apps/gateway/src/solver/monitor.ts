import { type PublicClient, parseAbiItem } from 'viem';
import { EventEmitter } from 'events';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface IntentEvent {
  orderId: string;
  user: string;
  sourceChain: number;
  destinationChain: number;
  inputToken: string;
  inputAmount: string;
  outputToken: string;
  outputAmount: string;
  recipient: string;
  deadline: number;
  blockNumber: bigint;
  transactionHash: string;
}

const OPEN_EVENT = parseAbiItem(
  'event Open(bytes32 indexed orderId, (address user, uint256 originChainId, uint32 openDeadline, uint32 fillDeadline, bytes32 orderId, (bytes32 token, uint256 amount, bytes32 recipient, uint256 chainId)[] maxSpent, (bytes32 token, uint256 amount, bytes32 recipient, uint256 chainId)[] minReceived, (uint64 destinationChainId, bytes32 destinationSettler, bytes originData)[] fillInstructions) order)'
);

function loadSettlers(): Record<number, `0x${string}`> {
  const path = resolve(process.cwd(), '../../packages/config/contracts.json');
  if (!existsSync(path)) {
    console.warn('⚠️ contracts.json not found');
    return {};
  }
  
  const contracts = JSON.parse(readFileSync(path, 'utf-8'));
  const out: Record<number, `0x${string}`> = {};

  for (const chain of Object.values(contracts.external || {})) {
    const c = chain as { chainId?: number; oif?: { inputSettler?: string } };
    if (c.chainId && c.oif?.inputSettler) out[c.chainId] = c.oif.inputSettler as `0x${string}`;
  }
  for (const net of ['testnet', 'mainnet'] as const) {
    const cfg = contracts[net];
    if (cfg?.chainId && cfg?.oif?.inputSettler) out[cfg.chainId] = cfg.oif.inputSettler as `0x${string}`;
  }
  return out;
}

const SETTLERS = loadSettlers();

export class EventMonitor extends EventEmitter {
  private chains: Array<{ chainId: number; name: string }>;
  private unwatchers: Array<() => void> = [];
  private running = false;

  constructor(config: { chains: Array<{ chainId: number; name: string }> }) {
    super();
    this.chains = config.chains;
  }

  async start(clients: Map<number, { public: PublicClient }>): Promise<void> {
    this.running = true;
    console.log('👁️ Starting event monitor...');

    for (const chain of this.chains) {
      const client = clients.get(chain.chainId);
      const settler = SETTLERS[chain.chainId];
      if (!client) continue;
      if (!settler) {
        console.warn(`   ⚠️ No settler for ${chain.name}, skipping`);
        continue;
      }

      const unwatch = client.public.watchContractEvent({
        address: settler,
        abi: [OPEN_EVENT],
        eventName: 'Open',
        onLogs: (logs) => logs.forEach(log => this.processEvent(chain.chainId, log)),
        onError: (err) => console.error(`Event error on ${chain.name}:`, err.message),
      });

      this.unwatchers.push(unwatch);
      console.log(`   ✓ Watching ${chain.name}`);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.unwatchers.forEach(fn => fn());
    this.unwatchers = [];
  }

  isRunning(): boolean {
    return this.running;
  }

  private processEvent(chainId: number, log: { args: Record<string, unknown>; blockNumber: bigint; transactionHash: `0x${string}` }): void {
    const args = log.args as {
      orderId: `0x${string}`;
      order: {
        user: `0x${string}`;
        maxSpent: Array<{ token: `0x${string}`; amount: bigint; chainId: bigint }>;
        minReceived: Array<{ token: `0x${string}`; amount: bigint; recipient: `0x${string}`; chainId: bigint }>;
        fillDeadline: number;
      };
    };

    const spent = args.order.maxSpent[0];
    const received = args.order.minReceived[0];

    this.emit('intent', {
      orderId: args.orderId,
      user: args.order.user,
      sourceChain: chainId,
      destinationChain: Number(received?.chainId || 0),
      inputToken: spent?.token.slice(0, 42) || '0x',
      inputAmount: spent?.amount.toString() || '0',
      outputToken: received?.token.slice(0, 42) || '0x',
      outputAmount: received?.amount.toString() || '0',
      recipient: received?.recipient.slice(0, 42) || '0x',
      deadline: args.order.fillDeadline,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    } as IntentEvent);
  }
}
