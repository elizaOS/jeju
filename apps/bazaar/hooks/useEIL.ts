'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { useState, useCallback, useEffect } from 'react'
import { parseEther, formatEther, type Address } from 'viem'

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
    name: 'supportedTokens',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
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
    name: 'VoucherFulfilled',
    inputs: [
      { name: 'voucherId', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false }
    ]
  }
] as const

// ============ Types ============

export interface CrossChainSwapParams {
  sourceToken: Address
  destinationToken: Address
  amount: bigint
  sourceChainId: number
  destinationChainId: number
  minAmountOut?: bigint
}

export interface ChainInfo {
  id: number
  name: string
  icon: string
  rpcUrl: string
  paymasterAddress?: Address
}

// EIL config from packages/config/eil.json
import eilConfig from '../../../packages/config/eil.json'

// ============ Supported Chains ============

export const SUPPORTED_CHAINS: ChainInfo[] = [
  { id: 420691, name: 'Jeju Mainnet', icon: '🏝️', rpcUrl: 'https://rpc.jeju.network' },
  { id: 420690, name: 'Jeju Testnet', icon: '🏝️', rpcUrl: 'https://testnet-rpc.jeju.network' },
  { id: 8453, name: 'Base', icon: '🔵', rpcUrl: 'https://mainnet.base.org' },
  { id: 42161, name: 'Arbitrum', icon: '🟠', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
  { id: 10, name: 'Optimism', icon: '🔴', rpcUrl: 'https://mainnet.optimism.io' },
  { id: 1, name: 'Ethereum', icon: '⚫', rpcUrl: 'https://eth.llamarpc.com' },
]

// ============ Hooks ============

/**
 * Hook to check if EIL is available and get configuration
 */
export function useEILConfig() {
  const { chain } = useAccount()
  const chainId = chain?.id?.toString() || '420691'
  
  // Get paymaster for current chain from config
  const crossChainPaymaster = eilConfig.crossChainPaymasters[chainId as keyof typeof eilConfig.crossChainPaymasters] as Address | undefined
  
  // Check if configured (not zero address)
  const isAvailable = crossChainPaymaster && crossChainPaymaster !== '0x0000000000000000000000000000000000000000'
  
  // Build chain info from config
  const configuredChains = SUPPORTED_CHAINS.map(chain => ({
    ...chain,
    paymasterAddress: eilConfig.crossChainPaymasters[chain.id.toString() as keyof typeof eilConfig.crossChainPaymasters] as Address | undefined
  }))

  return {
    isAvailable: Boolean(isAvailable),
    crossChainPaymaster: isAvailable ? crossChainPaymaster : undefined,
    supportedChains: configuredChains,
    l1StakeManager: eilConfig.l1StakeManager as Address,
    supportedTokens: eilConfig.supportedTokens as Address[],
  }
}

/**
 * Hook for cross-chain swaps via EIL
 */
export function useCrossChainSwap(paymasterAddress: Address | undefined) {
  const { address: userAddress } = useAccount()
  const [swapStatus, setSwapStatus] = useState<'idle' | 'approving' | 'swapping' | 'waiting' | 'complete' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isPending) {
      setSwapStatus('swapping')
    } else if (isConfirming) {
      setSwapStatus('waiting')
    } else if (isSuccess) {
      setSwapStatus('complete')
    }
  }, [isPending, isConfirming, isSuccess])

  const executeCrossChainSwap = useCallback(async (params: CrossChainSwapParams) => {
    if (!paymasterAddress || !userAddress) {
      setError('Wallet not connected or EIL not configured')
      return
    }

    setSwapStatus('swapping')
    setError(null)

    const maxFee = parseEther('0.01')
    const feeIncrement = parseEther('0.0001')
    const gasOnDestination = parseEther('0.001')

    // For ETH transfers, value = amount + maxFee. For ERC20, value = maxFee (for fee payment)
    const isETH = params.sourceToken === '0x0000000000000000000000000000000000000000'
    const txValue = isETH ? params.amount + maxFee : maxFee

    writeContract({
      address: paymasterAddress,
      abi: CROSS_CHAIN_PAYMASTER_ABI,
      functionName: 'createVoucherRequest',
      args: [
        params.sourceToken,
        params.amount,
        params.destinationToken,
        BigInt(params.destinationChainId),
        userAddress,
        gasOnDestination,
        maxFee,
        feeIncrement
      ],
      value: txValue
    })
  }, [paymasterAddress, userAddress, writeContract])

  const reset = useCallback(() => {
    setSwapStatus('idle')
    setError(null)
  }, [])

  return {
    executeCrossChainSwap,
    swapStatus,
    error,
    isLoading: isPending || isConfirming,
    isSuccess,
    hash,
    reset
  }
}

/**
 * Hook to estimate cross-chain swap fees
 */
export function useSwapFeeEstimate(
  sourceChainId: number,
  destinationChainId: number,
  amount: bigint
) {
  const [estimate, setEstimate] = useState({
    networkFee: parseEther('0.001'),
    xlpFee: parseEther('0.0005'),
    totalFee: parseEther('0.0015'),
    estimatedTime: 10, // seconds
    isLoading: false
  })

  useEffect(() => {
    // In production, this would fetch real-time estimates from XLPs
    // For now, use static estimates based on chain pair
    const baseFee = parseEther('0.001')
    const xlpPremium = parseEther('0.0005')
    
    setEstimate({
      networkFee: baseFee,
      xlpFee: xlpPremium,
      totalFee: baseFee + xlpPremium,
      estimatedTime: sourceChainId === destinationChainId ? 0 : 10,
      isLoading: false
    })
  }, [sourceChainId, destinationChainId, amount])

  return estimate
}

/**
 * Hook to check token support on a chain
 */
export function useTokenSupport(paymasterAddress: Address | undefined, tokenAddress: Address | undefined) {
  const { data: isSupported } = useReadContract({
    address: paymasterAddress,
    abi: CROSS_CHAIN_PAYMASTER_ABI,
    functionName: 'supportedTokens',
    args: tokenAddress ? [tokenAddress] : undefined,
  })

  return {
    isSupported: isSupported as boolean | undefined
  }
}

/**
 * Utility to format cross-chain swap route
 */
export function formatSwapRoute(sourceChain: ChainInfo, destChain: ChainInfo): string {
  return `${sourceChain.icon} ${sourceChain.name} → ${destChain.icon} ${destChain.name}`
}

/**
 * Utility to check if chains require cross-chain swap
 */
export function requiresCrossChainSwap(sourceChainId: number, destChainId: number): boolean {
  return sourceChainId !== destChainId
}

