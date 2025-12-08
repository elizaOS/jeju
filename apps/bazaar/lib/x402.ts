import { Address, parseEther, formatEther } from 'viem';

export interface PaymentRequirements {
  x402Version: number;
  error: string;
  accepts: PaymentScheme[];
}

export interface PaymentScheme {
  scheme: string; // 'exact' for now
  network: string; // 'base-sepolia', 'base', etc
  maxAmountRequired: string; // Wei amount as string
  asset: Address; // Token contract address
  payTo: Address; // Recipient address
  resource: string; // API endpoint/resource
  description: string;
  mimeType: string;
  outputSchema: string | null;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface PaymentPayload {
  scheme: string;
  network: string;
  asset: Address;
  payTo: Address;
  amount: string;
  resource: string;
  nonce: string;
  timestamp: number;
  signature?: string; // EIP-712 signature
}

export interface SettlementResponse {
  settled: boolean;
  txHash?: string;
  blockNumber?: number;
  timestamp?: number;
  amountSettled?: string;
  error?: string;
}

export const PAYMENT_TIERS = {
  // NFT Marketplace Fees
  NFT_LISTING: parseEther('0.001'), // 0.001 ETH to list NFT
  NFT_PURCHASE_FEE: 250, // 2.5% of purchase price (basis points)
  
  // DeFi Operation Fees
  SWAP_FEE: 30, // 0.3% of swap amount
  POOL_CREATION: parseEther('0.01'), // 0.01 ETH to create pool
  LIQUIDITY_ADD: parseEther('0.0001'), // Small fee per liquidity add
  
  // Token Launch Fees
  TOKEN_DEPLOYMENT: parseEther('0.005'), // 0.005 ETH to deploy token
  
  // Prediction Markets Fees
  MARKET_CREATION: parseEther('0.01'), // 0.01 ETH to create market
  TRADING_FEE: 50, // 0.5% of trade amount (basis points)
  
  // API Access Fees
  PREMIUM_API_DAILY: parseEther('0.1'), // Daily premium API access
  PREMIUM_API_MONTHLY: parseEther('2.0'), // Monthly premium access
  
  // Historical Data
  HISTORICAL_DATA: parseEther('0.05'), // One-time historical data access
} as const;

export function createPaymentRequirement(
  resource: string,
  amount: bigint,
  description: string,
  recipientAddress: Address,
  tokenAddress: Address = '0x0000000000000000000000000000000000000000', // ETH by default
  network: string = 'base-sepolia'
): PaymentRequirements {
  return {
    x402Version: 1,
    error: 'Payment required to access this resource',
    accepts: [{
      scheme: 'exact',
      network,
      maxAmountRequired: amount.toString(),
      asset: tokenAddress,
      payTo: recipientAddress,
      resource,
      description,
      mimeType: 'application/json',
      outputSchema: null,
      maxTimeoutSeconds: 300, // 5 minutes
      extra: {
        serviceName: 'Bazaar',
        category: description.includes('NFT') ? 'nft' : 
                  description.includes('Swap') || description.includes('Pool') ? 'defi' : 
                  'api',
      },
    }],
  };
}

const EIP712_DOMAIN = {
  name: 'x402 Payment Protocol',
  version: '1',
  chainId: 0, // Will be set based on network
  verifyingContract: '0x0000000000000000000000000000000000000000' as Address, // Can be payment processor contract
};

const EIP712_TYPES = {
  Payment: [
    { name: 'scheme', type: 'string' },
    { name: 'network', type: 'string' },
    { name: 'asset', type: 'address' },
    { name: 'payTo', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'resource', type: 'string' },
    { name: 'nonce', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};

export async function verifyPayment(
  payload: PaymentPayload,
  expectedAmount: bigint,
  expectedRecipient: Address
): Promise<{ valid: boolean; error?: string; signer?: Address }> {
  if (!payload.amount || !payload.payTo || !payload.asset) {
    return { valid: false, error: 'Missing required payment fields' };
  }

  const paymentAmount = BigInt(payload.amount);
  
  if (paymentAmount < expectedAmount) {
    return { 
      valid: false, 
      error: `Insufficient payment: ${formatEther(paymentAmount)} ETH < ${formatEther(expectedAmount)} ETH required` 
    };
  }

  if (payload.payTo.toLowerCase() !== expectedRecipient.toLowerCase()) {
    return { valid: false, error: `Invalid recipient: ${payload.payTo} !== ${expectedRecipient}` };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - payload.timestamp) > 300) {
    return { valid: false, error: 'Payment timestamp expired' };
  }

  if (!payload.signature) {
    return { valid: false, error: 'Payment signature required' };
  }

  const { verifyTypedData, recoverTypedDataAddress } = await import('viem');
  
  const chainId = payload.network === 'base-sepolia' ? 84532 : 
                  payload.network === 'base' ? 8453 : 1337;

  const domain = { ...EIP712_DOMAIN, chainId };

  const message = {
    scheme: payload.scheme,
    network: payload.network,
    asset: payload.asset,
    payTo: payload.payTo,
    amount: BigInt(payload.amount),
    resource: payload.resource,
    nonce: payload.nonce,
    timestamp: BigInt(payload.timestamp),
  };

  const signer = await recoverTypedDataAddress({
    domain,
    types: EIP712_TYPES,
    primaryType: 'Payment',
    message,
    signature: payload.signature as `0x${string}`,
  });

  const isValid = await verifyTypedData({
    address: signer,
    domain,
    types: EIP712_TYPES,
    primaryType: 'Payment',
    message,
    signature: payload.signature as `0x${string}`,
  });

  if (!isValid) {
    return { valid: false, error: 'Invalid payment signature' };
  }

  return { valid: true, signer };
}

export async function settlePayment(payload: PaymentPayload): Promise<SettlementResponse> {
  const { createPublicClient, createWalletClient, http, parseAbi } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { jeju } = await import('../config/chains');
  
  const settlementKey = process.env.NEXT_PUBLIC_SETTLEMENT_PRIVATE_KEY;
  
  if (!settlementKey) {
    return { settled: false, error: 'Settlement wallet not configured' };
  }

  const account = privateKeyToAccount(settlementKey as `0x${string}`);
  
  const publicClient = createPublicClient({ chain: jeju, transport: http() });
  const walletClient = createWalletClient({ account, chain: jeju, transport: http() });

  if (payload.asset === '0x0000000000000000000000000000000000000000') {
    return {
      settled: true,
      txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      blockNumber: Number(await publicClient.getBlockNumber()),
      timestamp: Math.floor(Date.now() / 1000),
      amountSettled: payload.amount,
    };
  }

  const erc20Abi = parseAbi([
    'function allowance(address owner, address spender) view returns (uint256)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  ]);

  const allowance = await publicClient.readContract({
    address: payload.asset,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, payload.payTo],
  });

  const requiredAmount = BigInt(payload.amount);
  
  if (allowance < requiredAmount) {
    return { settled: false, error: `Insufficient allowance: ${allowance} < ${requiredAmount}` };
  }

  const hash = await walletClient.writeContract({
    address: payload.asset,
    abi: erc20Abi,
    functionName: 'transferFrom',
    args: [account.address, payload.payTo, requiredAmount],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return {
    settled: true,
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
    timestamp: Math.floor(Date.now() / 1000),
    amountSettled: payload.amount,
  };
}

export function getEIP712Domain(network: string) {
  const chainId = network === 'base-sepolia' ? 84532 : 
                  network === 'base' ? 8453 : 
                  1337; // Jeju localnet

  return {
    ...EIP712_DOMAIN,
    chainId,
  };
}

export function getEIP712Types() {
  return EIP712_TYPES;
}

export function createPaymentPayload(
  asset: Address,
  payTo: Address,
  amount: bigint,
  resource: string,
  network: string = 'base-sepolia'
): Omit<PaymentPayload, 'signature'> {
  return {
    scheme: 'exact',
    network,
    asset,
    payTo,
    amount: amount.toString(),
    resource,
    nonce: Math.random().toString(36).substring(7),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

export async function signPaymentPayload(
  payload: Omit<PaymentPayload, 'signature'>,
  privateKey: `0x${string}`
): Promise<PaymentPayload> {
  const { privateKeyToAccount } = await import('viem/accounts');

  const account = privateKeyToAccount(privateKey);
  
  const domain = getEIP712Domain(payload.network);

  const message = {
    scheme: payload.scheme,
    network: payload.network,
    asset: payload.asset,
    payTo: payload.payTo,
    amount: BigInt(payload.amount),
    resource: payload.resource,
    nonce: payload.nonce,
    timestamp: BigInt(payload.timestamp),
  };

  const signature = await account.signTypedData({
    domain,
    types: EIP712_TYPES,
    primaryType: 'Payment',
    message,
  });

  return {
    ...payload,
    signature,
  };
}

export function calculatePercentageFee(amount: bigint, basisPoints: number): bigint {
  return (amount * BigInt(basisPoints)) / BigInt(10000);
}

export function parsePaymentHeader(headerValue: string | null): PaymentPayload | null {
  if (!headerValue) return null;
  try {
    const parsed = JSON.parse(headerValue) as PaymentPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function checkPayment(
  paymentHeader: string | null,
  requiredAmount: bigint,
  recipient: Address
): Promise<{ paid: boolean; settlement?: SettlementResponse; error?: string }> {
  const payment = parsePaymentHeader(paymentHeader);
  
  if (!payment) {
    return { paid: false, error: 'No payment header provided' };
  }

  const verification = await verifyPayment(payment, requiredAmount, recipient);
  
  if (!verification.valid) {
    return { paid: false, error: verification.error };
  }

  const settlement = await settlePayment(payment);
  
  if (!settlement.settled) {
    return { paid: false, error: settlement.error };
  }

  return { paid: true, settlement };
}

