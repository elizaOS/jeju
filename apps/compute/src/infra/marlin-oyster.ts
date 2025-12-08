/**
 * Marlin Oyster Serverless Integration
 *
 * 100% PERMISSIONLESS TEE DEPLOYMENT
 * - No API keys
 * - No logins
 * - Only wallet signatures
 *
 * Marlin Oyster runs on Arbitrum One with USDC payments.
 *
 * Contracts:
 * - Subscription Relay: 0x8Fb2C621d6E636063F0E49828f4Da7748135F3cB
 * - Relay: 0xD28179711eeCe385bc2096c5D199E15e6415A4f5
 * - USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
 */

import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  type Hex,
  http,
  parseAbi,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';

// Marlin Oyster Arbitrum contracts
export const MARLIN_CONTRACTS = {
  subscriptionRelay: '0x8Fb2C621d6E636063F0E49828f4Da7748135F3cB' as const,
  relay: '0xD28179711eeCe385bc2096c5D199E15e6415A4f5' as const,
  usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const,
} as const;

// Minimal ABIs for interaction
const USDC_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
]);

const SUBSCRIPTION_RELAY_ABI = parseAbi([
  // Job submission
  'function startJob(bytes32 codeHash, bytes calldata codeInputs, address refundAccount, uint256 gasLimit) payable returns (bytes32)',
  // Subscription management
  'function startSubscription(bytes32 codeHash, bytes calldata codeInputs, uint64 startTime, uint64 maxGasPrice, uint32 callbackGasLimit, uint64 periodicGap, uint64 terminationTime, address refundAccount) payable returns (bytes32)',
  'function terminateSubscription(bytes32 subscriptionId)',
  // Views
  'function getJobCount() view returns (uint256)',
  'function jobs(bytes32 jobId) view returns (uint64 startTime, uint64 maxGasPrice, uint32 callbackGasLimit, uint8 status)',
]);

export interface MarlinDeployResult {
  codeHash: Hex;
  txHash: Hex;
  deployedAt: number;
}

export interface MarlinSubscriptionResult {
  subscriptionId: Hex;
  txHash: Hex;
  startTime: number;
  terminationTime: number;
}

export interface MarlinJobResult {
  jobId: Hex;
  txHash: Hex;
  status: 'pending' | 'success' | 'failed';
}

/**
 * Marlin Oyster Client - 100% wallet-based, no API keys
 */
export class MarlinOysterClient {
  private publicClient;
  private walletClient;
  private account;

  constructor(privateKey: Hex, rpcUrl?: string) {
    this.account = privateKeyToAccount(privateKey);

    this.publicClient = createPublicClient({
      chain: arbitrum,
      transport: http(rpcUrl ?? 'https://arb1.arbitrum.io/rpc'),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: arbitrum,
      transport: http(rpcUrl ?? 'https://arb1.arbitrum.io/rpc'),
    });
  }

  /**
   * Get wallet address
   */
  get address(): Hex {
    return this.account.address;
  }

  /**
   * Check USDC balance
   */
  async getUSDCBalance(): Promise<bigint> {
    return this.publicClient.readContract({
      address: MARLIN_CONTRACTS.usdc,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [this.account.address],
    });
  }

  /**
   * Check USDC allowance for subscription relay
   */
  async getUSDCAllowance(): Promise<bigint> {
    return this.publicClient.readContract({
      address: MARLIN_CONTRACTS.usdc,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [this.account.address, MARLIN_CONTRACTS.subscriptionRelay],
    });
  }

  /**
   * Approve USDC for subscription relay
   */
  async approveUSDC(amount: bigint): Promise<Hex> {
    const hash = await this.walletClient.writeContract({
      address: MARLIN_CONTRACTS.usdc,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [MARLIN_CONTRACTS.subscriptionRelay, amount],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  /**
   * Deploy JavaScript code to Marlin Oyster
   *
   * Note: This uses the CLI under the hood since deployment
   * involves WASM/Workerd bundling. For direct integration,
   * use the subscription methods with pre-deployed code hashes.
   */
  async deployCode(jsCode: string): Promise<MarlinDeployResult> {
    // The CLI handles bundling and deployment
    // For now, we compute a deterministic code hash
    const encoder = new TextEncoder();
    const data = encoder.encode(jsCode);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const codeHash = `0x${Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}` as Hex;

    console.log(
      '⚠️  Code deployment requires the oyster-serverless CLI for Workerd bundling'
    );
    console.log('   Run: oyster-serverless deploy --wallet-private-key <key>');
    console.log(`   Code hash (computed): ${codeHash}`);

    return {
      codeHash,
      txHash: '0x0' as Hex, // Placeholder - CLI handles actual deployment
      deployedAt: Date.now(),
    };
  }

  /**
   * Start a one-time job
   */
  async startJob(
    codeHash: Hex,
    inputs: Uint8Array,
    gasLimit: bigint = 100000n
  ): Promise<MarlinJobResult> {
    const inputsHex = toHex(inputs);
    const hash = await this.walletClient.writeContract({
      address: MARLIN_CONTRACTS.subscriptionRelay,
      abi: SUBSCRIPTION_RELAY_ABI,
      functionName: 'startJob',
      args: [codeHash, inputsHex, this.account.address, gasLimit],
      value: 0n, // ETH for gas, adjust as needed
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Extract job ID from logs
    const jobId = (receipt.logs[0]?.topics[1] ?? '0x0') as Hex;

    return {
      jobId,
      txHash: hash,
      status: 'pending',
    };
  }

  /**
   * Create a recurring subscription
   */
  async createSubscription(params: {
    codeHash: Hex;
    inputs: Uint8Array;
    periodicGapSeconds: number;
    durationSeconds: number;
    callbackGasLimit?: number;
    maxGasPrice?: bigint;
  }): Promise<MarlinSubscriptionResult> {
    const startTime = BigInt(Math.floor(Date.now() / 1000));
    const terminationTime = startTime + BigInt(params.durationSeconds);
    const inputsHex = toHex(params.inputs);

    const hash = await this.walletClient.writeContract({
      address: MARLIN_CONTRACTS.subscriptionRelay,
      abi: SUBSCRIPTION_RELAY_ABI,
      functionName: 'startSubscription',
      args: [
        params.codeHash,
        inputsHex,
        startTime,
        params.maxGasPrice ?? 1000000000n, // 1 gwei default
        params.callbackGasLimit ?? 100000,
        BigInt(params.periodicGapSeconds),
        terminationTime,
        this.account.address,
      ],
      value: 0n, // ETH for gas
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Extract subscription ID from logs
    const subscriptionId = (receipt.logs[0]?.topics[1] ?? '0x0') as Hex;

    return {
      subscriptionId,
      txHash: hash,
      startTime: Number(startTime),
      terminationTime: Number(terminationTime),
    };
  }

  /**
   * Terminate a subscription
   */
  async terminateSubscription(subscriptionId: Hex): Promise<Hex> {
    const hash = await this.walletClient.writeContract({
      address: MARLIN_CONTRACTS.subscriptionRelay,
      abi: SUBSCRIPTION_RELAY_ABI,
      functionName: 'terminateSubscription',
      args: [subscriptionId],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  /**
   * Get account status - balances and allowances
   */
  async getAccountStatus(): Promise<{
    address: Hex;
    ethBalance: string;
    usdcBalance: string;
    usdcAllowance: string;
  }> {
    const [ethBalance, usdcBalance, usdcAllowance] = await Promise.all([
      this.publicClient.getBalance({ address: this.account.address }),
      this.getUSDCBalance(),
      this.getUSDCAllowance(),
    ]);

    return {
      address: this.account.address,
      ethBalance: formatUnits(ethBalance, 18),
      usdcBalance: formatUnits(usdcBalance, 6),
      usdcAllowance: formatUnits(usdcAllowance, 6),
    };
  }
}

/**
 * Generate Babylon game worker code for Marlin Oyster
 *
 * This generates JavaScript code compatible with Cloudflare's Workerd
 * that can run our game loop in a TEE.
 */
export function generateBabylonWorkerCode(_params: {
  gameContractAddress: Hex;
  arweaveGateway?: string;
}): string {
  return `
// Babylon Game Worker - Runs in Marlin Oyster TEE
// This code is executed in AWS Nitro Enclaves via Workerd

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        tee: 'marlin-oyster',
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/execute' && request.method === 'POST') {
      const body = await request.json();
      
      // Execute game action in TEE
      const result = await this.executeGameAction(body);
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/attestation') {
      // Return TEE attestation document
      // In real Nitro Enclave, this calls /dev/attestation
      return new Response(JSON.stringify({
        platform: 'aws-nitro',
        pcrs: {
          // PCR values would come from actual enclave
          pcr0: 'placeholder',
          pcr1: 'placeholder', 
          pcr2: 'placeholder'
        },
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Babylon TEE Worker', { status: 200 });
  },
  
  async executeGameAction(params) {
    const { action, gameState, playerId } = params;
    
    // Deterministic game logic runs here
    // Results can be verified via attestation
    
    const result = {
      action,
      playerId,
      processed: true,
      timestamp: Date.now(),
      // Hash of inputs for verification
      inputHash: await this.hashInputs(params)
    };
    
    return result;
  },
  
  async hashInputs(data) {
    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(dataStr));
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  }
};
`;
}

/**
 * CLI Commands for Marlin Oyster
 *
 * These are the commands to run manually for deployment.
 * The CLI handles Workerd bundling which requires native tools.
 */
export const MARLIN_CLI_COMMANDS = {
  install:
    'cargo install oyster-serverless --git https://github.com/marlinprotocol/oyster-monorepo',
  newProject: 'oyster-serverless new --name babylon-game',
  dev: 'oyster-serverless dev',
  deploy: 'oyster-serverless deploy --wallet-private-key $PRIVATE_KEY',
  createSubscription: `oyster-serverless subscription create \\
    --wallet-private-key $PRIVATE_KEY \\
    --code-hash $CODE_HASH \\
    --input-file input.json \\
    --user-timeout 5000 \\
    --callback-contract-address $GAME_CONTRACT \\
    --callback-gas-limit 100000 \\
    --periodic-gap 30`,
  terminate:
    'oyster-serverless terminate --wallet-private-key $PRIVATE_KEY --subscription-transaction-hash $TX_HASH',
};

/**
 * Print deployment instructions
 */
export function printDeploymentInstructions(
  privateKeyEnvVar: string = 'PRIVATE_KEY'
): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║               MARLIN OYSTER - 100% PERMISSIONLESS TEE                      ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  NO API KEYS. NO LOGIN. ONLY WALLET.                                       ║
║                                                                            ║
║  Network: Arbitrum One                                                     ║
║  Payment: USDC (0xaf88d065e77c8cC2239327C5EDb3A432268e5831)                 ║
║  TEE: AWS Nitro Enclaves                                                   ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║  DEPLOYMENT STEPS:                                                         ║
║                                                                            ║
║  1. Install CLI:                                                           ║
║     cargo install oyster-serverless \\                                      ║
║       --git https://github.com/marlinprotocol/oyster-monorepo              ║
║                                                                            ║
║  2. Create project:                                                        ║
║     oyster-serverless new --name babylon-game                              ║
║                                                                            ║
║  3. Deploy code (wallet-signed):                                           ║
║     oyster-serverless deploy --wallet-private-key $${privateKeyEnvVar}        ║
║                                                                            ║
║  4. Create subscription (wallet-signed):                                   ║
║     oyster-serverless subscription create \\                                ║
║       --wallet-private-key $${privateKeyEnvVar} \\                            ║
║       --code-hash <hash-from-deploy> \\                                     ║
║       --periodic-gap 30                                                    ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
}
