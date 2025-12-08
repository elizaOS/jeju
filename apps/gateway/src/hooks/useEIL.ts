import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { useState, useCallback } from 'react';
import { parseEther, type Address } from 'viem';

// ============ ABIs ============

const CROSS_CHAIN_PAYMASTER_ABI = [
  {
    type: 'function',
    name: 'createVoucherRequest',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'destinationToken', type: 'address' },
      { name: 'destinationChainId', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'gasOnDestination', type: 'uint256' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'feeIncrement', type: 'uint256' }
    ],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'getCurrentFee',
    inputs: [{ name: 'requestId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'canFulfillRequest',
    inputs: [{ name: 'requestId', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'refundExpiredRequest',
    inputs: [{ name: 'requestId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'supportedTokens',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'depositLiquidity',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'depositETH',
    inputs: [],
    outputs: [],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'withdrawLiquidity',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'withdrawETH',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getXLPLiquidity',
    inputs: [
      { name: 'xlp', type: 'address' },
      { name: 'token', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getXLPETH',
    inputs: [{ name: 'xlp', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'VoucherRequested',
    inputs: [
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'requester', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'destinationChainId', type: 'uint256', indexed: false },
      { name: 'recipient', type: 'address', indexed: false },
      { name: 'maxFee', type: 'uint256', indexed: false },
      { name: 'deadline', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'VoucherIssued',
    inputs: [
      { name: 'voucherId', type: 'bytes32', indexed: true },
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'xlp', type: 'address', indexed: true },
      { name: 'fee', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'VoucherFulfilled',
    inputs: [
      { name: 'voucherId', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false }
    ]
  }
] as const;

const L1_STAKE_MANAGER_ABI = [
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'chains', type: 'uint256[]' }],
    outputs: [],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'addStake',
    inputs: [],
    outputs: [],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'startUnbonding',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'completeUnbonding',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getStake',
    inputs: [{ name: 'xlp', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'stakedAmount', type: 'uint256' },
        { name: 'unbondingAmount', type: 'uint256' },
        { name: 'unbondingStartTime', type: 'uint256' },
        { name: 'slashedAmount', type: 'uint256' },
        { name: 'isActive', type: 'bool' },
        { name: 'registeredAt', type: 'uint256' }
      ]
    }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getXLPChains',
    inputs: [{ name: 'xlp', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'isXLPActive',
    inputs: [{ name: 'xlp', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getEffectiveStake',
    inputs: [{ name: 'xlp', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getUnbondingTimeRemaining',
    inputs: [{ name: 'xlp', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  }
] as const;

// ============ Types ============

export interface TransferRequest {
  requestId: `0x${string}`;
  sourceChain: number;
  destinationChain: number;
  sourceToken: Address;
  destinationToken: Address;
  amount: bigint;
  maxFee: bigint;
  recipient: Address;
  deadline: number;
  status: 'pending' | 'claimed' | 'fulfilled' | 'expired' | 'refunded';
}

export interface XLPStake {
  stakedAmount: bigint;
  unbondingAmount: bigint;
  unbondingStartTime: bigint;
  slashedAmount: bigint;
  isActive: boolean;
  registeredAt: bigint;
}

export interface XLPLiquidity {
  token: Address;
  amount: bigint;
}

// ============ Hooks ============

/**
 * Hook for cross-chain transfers via EIL
 */
export function useCrossChainTransfer(paymasterAddress: Address | undefined) {
  const { address: userAddress } = useAccount();
  const [transferStatus, setTransferStatus] = useState<'idle' | 'approving' | 'requesting' | 'waiting' | 'complete' | 'error'>('idle');
  const [_currentRequest, _setCurrentRequest] = useState<TransferRequest | null>(null);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createTransfer = useCallback(async (params: {
    sourceToken: Address;
    destinationToken: Address;
    amount: bigint;
    destinationChainId: number;
    recipient?: Address;
    gasOnDestination?: bigint;
    maxFee?: bigint;
    feeIncrement?: bigint;
  }) => {
    if (!paymasterAddress || !userAddress) return;

    setTransferStatus('requesting');

    const recipient = params.recipient || userAddress;
    const gasOnDestination = params.gasOnDestination || parseEther('0.001');
    const maxFee = params.maxFee || parseEther('0.01');
    const feeIncrement = params.feeIncrement || parseEther('0.0001');

    // For ETH transfers, value = amount + maxFee. For ERC20, value = maxFee (for fee payment)
    const isETH = params.sourceToken === '0x0000000000000000000000000000000000000000';
    const txValue = isETH ? params.amount + maxFee : maxFee;

    writeContract({
      address: paymasterAddress,
      abi: CROSS_CHAIN_PAYMASTER_ABI,
      functionName: 'createVoucherRequest',
      args: [
        params.sourceToken,
        params.amount,
        params.destinationToken,
        BigInt(params.destinationChainId),
        recipient,
        gasOnDestination,
        maxFee,
        feeIncrement
      ],
      value: txValue
    });
  }, [paymasterAddress, userAddress, writeContract]);

  const refundExpired = useCallback(async (requestId: `0x${string}`) => {
    if (!paymasterAddress) return;

    writeContract({
      address: paymasterAddress,
      abi: CROSS_CHAIN_PAYMASTER_ABI,
      functionName: 'refundExpiredRequest',
      args: [requestId]
    });
  }, [paymasterAddress, writeContract]);

  return {
    createTransfer,
    refundExpired,
    transferStatus,
    isLoading: isPending || isConfirming,
    isSuccess,
    hash
  };
}

/**
 * Hook for XLP liquidity management
 */
export function useXLPLiquidity(paymasterAddress: Address | undefined) {
  const { address: userAddress } = useAccount();

  // Read XLP ETH balance
  const { data: xlpETH } = useReadContract({
    address: paymasterAddress,
    abi: CROSS_CHAIN_PAYMASTER_ABI,
    functionName: 'getXLPETH',
    args: userAddress ? [userAddress] : undefined,
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const depositETH = useCallback(async (amount: bigint) => {
    if (!paymasterAddress) return;

    writeContract({
      address: paymasterAddress,
      abi: CROSS_CHAIN_PAYMASTER_ABI,
      functionName: 'depositETH',
      value: amount
    });
  }, [paymasterAddress, writeContract]);

  const withdrawETH = useCallback(async (amount: bigint) => {
    if (!paymasterAddress) return;

    writeContract({
      address: paymasterAddress,
      abi: CROSS_CHAIN_PAYMASTER_ABI,
      functionName: 'withdrawETH',
      args: [amount]
    });
  }, [paymasterAddress, writeContract]);

  const depositToken = useCallback(async (token: Address, amount: bigint) => {
    if (!paymasterAddress) return;

    writeContract({
      address: paymasterAddress,
      abi: CROSS_CHAIN_PAYMASTER_ABI,
      functionName: 'depositLiquidity',
      args: [token, amount]
    });
  }, [paymasterAddress, writeContract]);

  const withdrawToken = useCallback(async (token: Address, amount: bigint) => {
    if (!paymasterAddress) return;

    writeContract({
      address: paymasterAddress,
      abi: CROSS_CHAIN_PAYMASTER_ABI,
      functionName: 'withdrawLiquidity',
      args: [token, amount]
    });
  }, [paymasterAddress, writeContract]);

  const getTokenLiquidity = useCallback(async (_token: Address): Promise<bigint | undefined> => {
    if (!paymasterAddress || !userAddress) return undefined;
    // This would need to be called via the public client
    return undefined;
  }, [paymasterAddress, userAddress]);

  return {
    xlpETH: xlpETH as bigint | undefined,
    depositETH,
    withdrawETH,
    depositToken,
    withdrawToken,
    getTokenLiquidity,
    isLoading: isPending || isConfirming,
    isSuccess,
    hash
  };
}

/**
 * Hook for XLP stake management on L1
 */
export function useXLPStake(stakeManagerAddress: Address | undefined) {
  const { address: userAddress } = useAccount();

  // Read stake info
  const { data: stake, refetch: refetchStake } = useReadContract({
    address: stakeManagerAddress,
    abi: L1_STAKE_MANAGER_ABI,
    functionName: 'getStake',
    args: userAddress ? [userAddress] : undefined,
  });

  const { data: chains } = useReadContract({
    address: stakeManagerAddress,
    abi: L1_STAKE_MANAGER_ABI,
    functionName: 'getXLPChains',
    args: userAddress ? [userAddress] : undefined,
  });

  const { data: unbondingTime } = useReadContract({
    address: stakeManagerAddress,
    abi: L1_STAKE_MANAGER_ABI,
    functionName: 'getUnbondingTimeRemaining',
    args: userAddress ? [userAddress] : undefined,
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = useCallback(async (supportedChains: number[], stakeAmount: bigint) => {
    if (!stakeManagerAddress) return;

    writeContract({
      address: stakeManagerAddress,
      abi: L1_STAKE_MANAGER_ABI,
      functionName: 'register',
      args: [supportedChains.map(c => BigInt(c))],
      value: stakeAmount
    });
  }, [stakeManagerAddress, writeContract]);

  const addStake = useCallback(async (amount: bigint) => {
    if (!stakeManagerAddress) return;

    writeContract({
      address: stakeManagerAddress,
      abi: L1_STAKE_MANAGER_ABI,
      functionName: 'addStake',
      value: amount
    });
  }, [stakeManagerAddress, writeContract]);

  const startUnbonding = useCallback(async (amount: bigint) => {
    if (!stakeManagerAddress) return;

    writeContract({
      address: stakeManagerAddress,
      abi: L1_STAKE_MANAGER_ABI,
      functionName: 'startUnbonding',
      args: [amount]
    });
  }, [stakeManagerAddress, writeContract]);

  const completeUnbonding = useCallback(async () => {
    if (!stakeManagerAddress) return;

    writeContract({
      address: stakeManagerAddress,
      abi: L1_STAKE_MANAGER_ABI,
      functionName: 'completeUnbonding'
    });
  }, [stakeManagerAddress, writeContract]);

  type StakeResult = {
    stakedAmount: bigint;
    unbondingAmount: bigint;
    unbondingStartTime: bigint;
    slashedAmount: bigint;
    isActive: boolean;
    registeredAt: bigint;
  };

  const stakeInfo: XLPStake | null = stake ? {
    stakedAmount: (stake as StakeResult).stakedAmount,
    unbondingAmount: (stake as StakeResult).unbondingAmount,
    unbondingStartTime: (stake as StakeResult).unbondingStartTime,
    slashedAmount: (stake as StakeResult).slashedAmount,
    isActive: (stake as StakeResult).isActive,
    registeredAt: (stake as StakeResult).registeredAt,
  } : null;

  return {
    stake: stakeInfo,
    supportedChains: chains as bigint[] | undefined,
    unbondingTimeRemaining: unbondingTime as bigint | undefined,
    register,
    addStake,
    startUnbonding,
    completeUnbonding,
    refetchStake,
    isLoading: isPending || isConfirming,
    isSuccess,
    hash
  };
}

// EIL config from packages/config/eil.json
import eilConfig from '../../../../packages/config/eil.json';

/**
 * Hook for reading EIL contract addresses from config
 */
export function useEILConfig() {
  const { chain } = useAccount();
  const chainId = chain?.id?.toString() || '420691';
  
  // Get paymaster for current chain
  const crossChainPaymaster = eilConfig.crossChainPaymasters[chainId as keyof typeof eilConfig.crossChainPaymasters] as Address | undefined;
  const l1StakeManager = eilConfig.l1StakeManager as Address;
  
  // Check if addresses are valid (not zero address)
  const isConfigured = crossChainPaymaster && crossChainPaymaster !== '0x0000000000000000000000000000000000000000';

  return {
    crossChainPaymaster: isConfigured ? crossChainPaymaster : undefined,
    l1StakeManager,
    networks: eilConfig.networks,
    supportedTokens: eilConfig.supportedTokens,
    isConfigured: Boolean(isConfigured),
  };
}

