import { Address, createPublicClient, http, parseEther, parseAbi } from 'viem';
import { jeju } from '../config/chains';

export interface PaymasterInfo {
  address: Address
  token: Address
  tokenSymbol: string
  tokenName: string
  stakedEth: bigint
  isActive: boolean
  exchangeRate: bigint
}

export interface PaymasterFactoryConfig {
  factoryAddress: Address
  minStakedEth: bigint
}

export interface PaymasterOption {
  label: string
  value: Address
  token: { address: Address; symbol: string; name: string }
  estimatedCost: string
  stakedEth: string
  recommended: boolean
}

const DEFAULT_CONFIG: PaymasterFactoryConfig = {
  factoryAddress: '0x0000000000000000000000000000000000000000' as Address,
  minStakedEth: parseEther('1.0'),
};

const FACTORY_ABI = parseAbi([
  'function getAllPaymasters() view returns (address[])',
  'function getPaymasterInfo(address paymaster) view returns (address token, uint256 stakedEth, bool isActive)',
]);

const ERC20_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

export async function getAvailablePaymasters(
  config: PaymasterFactoryConfig = DEFAULT_CONFIG
): Promise<PaymasterInfo[]> {
  if (config.factoryAddress === '0x0000000000000000000000000000000000000000') {
    return [];
  }

  const publicClient = createPublicClient({
    chain: jeju,
    transport: http(),
  });

  const paymasterAddresses = await publicClient.readContract({
    address: config.factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'getAllPaymasters',
  }) as Address[];

  const paymasters: PaymasterInfo[] = [];

  for (const paymasterAddress of paymasterAddresses) {
    const info = await publicClient.readContract({
      address: config.factoryAddress,
      abi: FACTORY_ABI,
      functionName: 'getPaymasterInfo',
      args: [paymasterAddress],
    }) as [Address, bigint, boolean];

    const [tokenAddress, stakedEth, isActive] = info;

    if (stakedEth < config.minStakedEth || !isActive) continue;

    const [tokenSymbol, tokenName] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }) as Promise<string>,
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'name',
      }) as Promise<string>,
    ]);

    paymasters.push({
      address: paymasterAddress,
      token: tokenAddress,
      tokenSymbol,
      tokenName,
      stakedEth,
      isActive,
      exchangeRate: parseEther('1'),
    });
  }

  return paymasters;
}

export async function getPaymasterForToken(
  tokenAddress: Address,
  config: PaymasterFactoryConfig = DEFAULT_CONFIG
): Promise<PaymasterInfo | null> {
  const paymasters = await getAvailablePaymasters(config);
  return paymasters.find(pm => 
    pm.token.toLowerCase() === tokenAddress.toLowerCase()
  ) || null;
}

export function estimateTokenCost(
  gasEstimate: bigint,
  gasPrice: bigint,
  paymaster: PaymasterInfo
): bigint {
  const ethCost = gasEstimate * gasPrice;
  const tokenCost = (ethCost * paymaster.exchangeRate) / parseEther('1');
  return tokenCost;
}

export function preparePaymasterData(
  paymasterAddress: Address,
  tokenAddress: Address,
  maxTokenAmount: bigint
): {
  paymaster: Address;
  paymasterData: `0x${string}`;
} {
  const paymasterData = `0x${
    tokenAddress.slice(2)}${
    maxTokenAmount.toString(16).padStart(64, '0')
  }` as `0x${string}`;

  return {
    paymaster: paymasterAddress,
    paymasterData,
  };
}

export async function checkPaymasterApproval(
  userAddress: Address,
  tokenAddress: Address,
  paymasterAddress: Address,
  amount: bigint
): Promise<boolean> {
  const publicClient = createPublicClient({
    chain: jeju,
    transport: http(),
  });

  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress, paymasterAddress],
  }) as bigint;

  return allowance >= amount;
}

export function getApprovalTxData(
  tokenAddress: Address,
  paymasterAddress: Address,
  amount: bigint
): {
  to: Address;
  data: `0x${string}`;
} {
  const approveSelector = '0x095ea7b3';
  const data = `${approveSelector}${
    paymasterAddress.slice(2).padStart(64, '0')}${
    amount.toString(16).padStart(64, '0')
  }` as `0x${string}`;

  return {
    to: tokenAddress,
    data,
  };
}

export async function getPaymasterOptions(
  estimatedGas: bigint,
  gasPrice: bigint
): Promise<PaymasterOption[]> {
  const paymasters = await getAvailablePaymasters();
  
  return paymasters.map(pm => {
    const tokenCost = estimateTokenCost(estimatedGas, gasPrice, pm);
    const tokenCostFormatted = Number(tokenCost) / Math.pow(10, 18);
    
    return {
      label: `Pay gas with ${pm.tokenSymbol}`,
      value: pm.address,
      token: {
        address: pm.token,
        symbol: pm.tokenSymbol,
        name: pm.tokenName,
      },
      estimatedCost: `~${tokenCostFormatted.toFixed(4)} ${pm.tokenSymbol}`,
      stakedEth: `${Number(pm.stakedEth) / 1e18} ETH staked`,
      recommended: pm.tokenSymbol === 'USDC' || pm.tokenSymbol === 'elizaOS',
    };
  });
}

export async function loadPaymasterConfig(): Promise<PaymasterFactoryConfig> {
  const factoryAddress = process.env.NEXT_PUBLIC_PAYMASTER_FACTORY_ADDRESS;
  const minStake = process.env.NEXT_PUBLIC_PAYMASTER_MIN_STAKE;

  if (factoryAddress && factoryAddress !== '0x0000000000000000000000000000000000000000') {
    return {
      factoryAddress: factoryAddress as Address,
      minStakedEth: minStake ? parseEther(minStake) : parseEther('1.0'),
    };
  }

  return DEFAULT_CONFIG;
}
