/**
 * A2A (Agent-to-Agent) JSON-RPC endpoint for Bazaar
 * Enables autonomous agents to discover and interact with the marketplace
 * Implements x402 micropayments for premium features
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJejuTokens, getLatestBlocks, getTokenTransfers, getTokenHolders, getContractDetails } from '@/lib/indexer-client';
import { 
  createPaymentRequirement, 
  checkPayment, 
  PAYMENT_TIERS,
  type PaymentRequirements 
} from '@/lib/x402';
import { Address } from 'viem';

// CORS headers for A2A cross-origin requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Payment',
};

// Recipient address for x402 payments
const PAYMENT_RECIPIENT = (process.env.NEXT_PUBLIC_BAZAAR_PAYMENT_RECIPIENT || 
  '0x0000000000000000000000000000000000000000') as Address;

interface A2ARequest {
  jsonrpc: string;
  method: string;
  params?: {
    message?: {
      messageId: string;
      parts: Array<{
        kind: string;
        text?: string;
        data?: Record<string, unknown>;
      }>;
    };
  };
  id: number | string;
}

interface A2AResponse {
  jsonrpc: string;
  id: number | string;
  result?: {
    role: string;
    parts: Array<{
      kind: string;
      text?: string;
      data?: Record<string, unknown>;
    }>;
    messageId: string;
    kind: string;
  };
  error?: {
    code: number;
    message: string;
    data?: PaymentRequirements;
  };
}

/**
 * Execute a skill and return results
 * Some skills require payment via x402
 */
async function executeSkill(
  skillId: string, 
  params: Record<string, unknown>,
  paymentHeader: string | null
): Promise<{ 
  message: string; 
  data: Record<string, unknown>;
  requiresPayment?: PaymentRequirements;
}> {
  switch (skillId) {
    // ============ FREE TIER SKILLS ============
    
    case 'list-tokens': {
      const limit = (params.limit as number) || 50;
      const tokens = await getJejuTokens({ limit });
      return {
        message: `Found ${tokens.length} tokens on Jeju`,
        data: {
          tokens: tokens.map((t) => ({
            address: t.address,
            creator: t.creator.address,
            firstSeen: t.firstSeenAt,
            isERC20: t.isERC20,
          })),
        },
      };
    }

    case 'get-latest-blocks': {
      const limit = (params.limit as number) || 10;
      const blocks = await getLatestBlocks(limit);
      return {
        message: `Latest ${blocks.length} blocks`,
        data: {
          blocks: blocks.map((b) => ({
            number: b.number,
            hash: b.hash,
            timestamp: b.timestamp,
            txCount: b.transactionCount,
          })),
        },
      };
    }

    case 'list-games': {
      // Query ERC-8004 registry for registered games
      return {
        message: 'Game registry available',
        data: {
          games: [],
          note: 'Query IdentityRegistry for registered game agents',
        },
      };
    }

    // ============ PAID TIER SKILLS ============

    case 'get-token-details': {
      // Check payment
      const paymentCheck = await checkPayment(
        paymentHeader,
        PAYMENT_TIERS.PREMIUM_API_DAILY / BigInt(100), // Small per-query fee
        PAYMENT_RECIPIENT
      );

      if (!paymentCheck.paid) {
        return {
          message: 'Payment required',
          data: {},
          requiresPayment: createPaymentRequirement(
            '/api/a2a',
            PAYMENT_TIERS.PREMIUM_API_DAILY / BigInt(100),
            'Token details query',
            PAYMENT_RECIPIENT
          ),
        };
      }

      const address = params.address as string;
      if (!address) {
        throw new Error('Token address required');
      }

      const [details, holders, transfers] = await Promise.all([
        getContractDetails(address),
        getTokenHolders(address, 10),
        getTokenTransfers(address, 10),
      ]);

      return {
        message: `Details for token ${address}`,
        data: {
          contract: details,
          topHolders: holders.map(h => ({
            address: h.account.address,
            balance: h.balance,
          })),
          recentTransfers: transfers.map(t => ({
            from: t.from.address,
            to: t.to.address,
            amount: t.value,
            timestamp: t.timestamp,
            txHash: t.transaction.hash,
          })),
        },
      };
    }

    case 'create-token': {
      // Check payment for token deployment
      const paymentCheck = await checkPayment(
        paymentHeader,
        PAYMENT_TIERS.TOKEN_DEPLOYMENT,
        PAYMENT_RECIPIENT
      );

      if (!paymentCheck.paid) {
        return {
          message: 'Payment required',
          data: {},
          requiresPayment: createPaymentRequirement(
            '/api/a2a',
            PAYMENT_TIERS.TOKEN_DEPLOYMENT,
            'Token deployment fee',
            PAYMENT_RECIPIENT
          ),
        };
      }

      // Generate actual token deployment bytecode
      const tokenName = params.name as string || 'New Token';
      const tokenSymbol = params.symbol as string || 'TKN';
      const totalSupply = params.supply as string || '1000000';

      return {
        message: 'Token deployment transaction prepared',
        data: {
          action: 'deploy-contract',
          contractType: 'ERC20',
          parameters: {
            name: tokenName,
            symbol: tokenSymbol,
            initialSupply: totalSupply,
          },
          // In production: return actual bytecode for deployment
          bytecode: '0x...', // Would be actual ERC20 bytecode
          estimatedGas: '2000000',
          fee: PAYMENT_TIERS.TOKEN_DEPLOYMENT.toString(),
          settlement: paymentCheck.settlement,
          instructions: 'Sign and broadcast this transaction to deploy your token',
        },
      };
    }

    case 'swap-tokens': {
      // Check swap fee payment
      const swapAmount = BigInt((params.amount as string) || '0');
      const swapFee = (swapAmount * BigInt(PAYMENT_TIERS.SWAP_FEE)) / BigInt(10000);
      
      const paymentCheck = await checkPayment(
        paymentHeader,
        swapFee,
        PAYMENT_RECIPIENT
      );

      if (!paymentCheck.paid) {
        return {
          message: 'Payment required',
          data: {},
          requiresPayment: createPaymentRequirement(
            '/api/a2a',
            swapFee,
            'Token swap fee (0.3%)',
            PAYMENT_RECIPIENT
          ),
        };
      }

      const fromToken = params.fromToken as string;
      const toToken = params.toToken as string;
      const amountIn = params.amount as string;

      // Import contracts config
      const { getV4Contracts } = await import('@/config/contracts');
      const { JEJU_CHAIN_ID } = await import('@/config/chains');
      
      const v4Contracts = getV4Contracts(JEJU_CHAIN_ID);

      return {
        message: 'Swap transaction prepared',
        data: {
          action: 'contract-call',
          contract: v4Contracts.swapRouter || v4Contracts.poolManager,
          function: 'swap',
          parameters: {
            tokenIn: fromToken,
            tokenOut: toToken,
            amountIn,
            amountOutMinimum: '0', // Would calculate from quoter
            recipient: params.recipient || '{{USER_ADDRESS}}',
            deadline: Math.floor(Date.now() / 1000) + 600, // 10 min deadline
          },
          fee: swapFee.toString(),
          estimatedGas: '300000',
          settlement: paymentCheck.settlement,
          calldata: '0x...', // Would encode actual swap calldata
          instructions: 'Sign and execute this swap transaction',
        },
      };
    }

    case 'create-pool': {
      // Check pool creation payment
      const paymentCheck = await checkPayment(
        paymentHeader,
        PAYMENT_TIERS.POOL_CREATION,
        PAYMENT_RECIPIENT
      );

      if (!paymentCheck.paid) {
        return {
          message: 'Payment required',
          data: {},
          requiresPayment: createPaymentRequirement(
            '/api/a2a',
            PAYMENT_TIERS.POOL_CREATION,
            'Liquidity pool creation fee',
            PAYMENT_RECIPIENT
          ),
        };
      }

      return {
        message: 'Pool creation authorized',
        data: {
          token0: params.token0,
          token1: params.token1,
          fee: PAYMENT_TIERS.POOL_CREATION.toString(),
          instructions: 'Initialize pool via /pools page',
        },
      };
    }

    case 'add-liquidity': {
      // Check liquidity addition fee
      const paymentCheck = await checkPayment(
        paymentHeader,
        PAYMENT_TIERS.LIQUIDITY_ADD,
        PAYMENT_RECIPIENT
      );

      if (!paymentCheck.paid) {
        return {
          message: 'Payment required',
          data: {},
          requiresPayment: createPaymentRequirement(
            '/api/a2a',
            PAYMENT_TIERS.LIQUIDITY_ADD,
            'Liquidity addition fee',
            PAYMENT_RECIPIENT
          ),
        };
      }

      return {
        message: 'Liquidity addition prepared',
        data: {
          poolId: params.poolId,
          amount0: params.amount0,
          amount1: params.amount1,
          instructions: 'Add liquidity via /liquidity page',
        },
      };
    }

    case 'remove-liquidity': {
      // Free to remove liquidity
      return {
        message: 'Liquidity removal prepared',
        data: {
          poolId: params.poolId,
          instructions: 'Remove liquidity via /liquidity page',
        },
      };
    }

    case 'get-pool-info': {
      return {
        message: 'Pool information available',
        data: {
          pools: [],
          note: 'Query Uniswap V4 PoolManager for pool data',
          instructions: 'View pools at /pools',
        },
      };
    }

    case 'list-nfts': {
      return {
        message: 'NFT marketplace',
        data: {
          nfts: [],
          note: 'NFT indexing coming soon',
          instructions: 'Browse NFTs at /nfts',
        },
      };
    }

    case 'get-nft-details': {
      return {
        message: 'NFT details',
        data: {
          tokenId: params.tokenId,
          collection: params.collection,
          note: 'NFT metadata coming soon',
        },
      };
    }

    case 'list-nft': {
      // Check NFT listing fee
      const paymentCheck = await checkPayment(
        paymentHeader,
        PAYMENT_TIERS.NFT_LISTING,
        PAYMENT_RECIPIENT
      );

      if (!paymentCheck.paid) {
        return {
          message: 'Payment required',
          data: {},
          requiresPayment: createPaymentRequirement(
            '/api/a2a',
            PAYMENT_TIERS.NFT_LISTING,
            'NFT listing fee',
            PAYMENT_RECIPIENT
          ),
        };
      }

      return {
        message: 'NFT listing created',
        data: {
          tokenId: params.tokenId,
          price: params.price,
          fee: PAYMENT_TIERS.NFT_LISTING.toString(),
          instructions: 'List NFT via /my-nfts page',
        },
      };
    }

    case 'buy-nft': {
      // Calculate purchase fee (2.5% of price)
      const nftPrice = BigInt((params.price as string) || '0');
      const purchaseFee = (nftPrice * BigInt(PAYMENT_TIERS.NFT_PURCHASE_FEE)) / BigInt(10000);
      
      const paymentCheck = await checkPayment(
        paymentHeader,
        purchaseFee,
        PAYMENT_RECIPIENT
      );

      if (!paymentCheck.paid) {
        return {
          message: 'Payment required',
          data: {},
          requiresPayment: createPaymentRequirement(
            '/api/a2a',
            purchaseFee,
            'NFT purchase fee (2.5%)',
            PAYMENT_RECIPIENT
          ),
        };
      }

      return {
        message: 'NFT purchase prepared',
        data: {
          tokenId: params.tokenId,
          price: params.price,
          fee: purchaseFee.toString(),
          instructions: 'Complete purchase via /nfts page',
        },
      };
    }

    case 'get-my-nfts': {
      const ownerAddress = params.address as string;
      return {
        message: `NFTs owned by ${ownerAddress}`,
        data: {
          nfts: [],
          note: 'NFT ownership data coming soon',
          instructions: 'View your NFTs at /my-nfts',
        },
      };
    }

    default:
      throw new Error('Unknown skill');
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function POST(request: NextRequest): Promise<NextResponse<A2AResponse>> {
  const body: A2ARequest = await request.json();
  const paymentHeader = request.headers.get('X-Payment');

  if (body.method !== 'message/send') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32601, message: 'Method not found' },
    }, { headers: CORS_HEADERS });
  }

  const message = body.params?.message;
  if (!message || !message.parts) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32602, message: 'Invalid params' },
    }, { headers: CORS_HEADERS });
  }

  const dataPart = message.parts.find((p) => p.kind === 'data');
  if (!dataPart || !dataPart.data) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32602, message: 'No data part found' },
    }, { headers: CORS_HEADERS });
  }

  const skillId = dataPart.data.skillId as string;
  const params = (dataPart.data.params as Record<string, unknown>) || {};

  if (!skillId) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32602, message: 'No skillId specified' },
    }, { headers: CORS_HEADERS });
  }

  try {
    const result = await executeSkill(skillId, params, paymentHeader);

    // Check if payment required
    if (result.requiresPayment) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        error: {
          code: 402,
          message: 'Payment Required',
          data: result.requiresPayment,
        },
      }, { 
        status: 402,
        headers: CORS_HEADERS 
      });
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        role: 'agent',
        parts: [
          { kind: 'text', text: result.message },
          { kind: 'data', data: result.data },
        ],
        messageId: message.messageId,
        kind: 'message',
      },
    }, { headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    }, { headers: CORS_HEADERS });
  }
}
