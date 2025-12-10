import { useWriteContract, useAccount, useReadContracts } from 'wagmi'
import { getXLPContracts } from '@/config/contracts'
import { JEJU_CHAIN_ID } from '@/config/chains'
import type { Address, Abi } from 'viem'
import { encodePacked } from 'viem'

// XLP Router ABI (minimal)
const ROUTER_ABI: Abi = [
  // V2 Functions
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokensV2',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokensV2',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForETHV2',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // V3 Functions
  {
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    name: 'exactInputSingleV3',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'amountOut', type: 'uint256' },
      { name: 'amountInMaximum', type: 'uint256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    name: 'exactOutputSingleV3',
    outputs: [{ name: 'amountIn', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Quote functions
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOutV2',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsInV2',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
]

export interface SwapV2Params {
  amountIn: bigint
  amountOutMin: bigint
  path: Address[]
  deadline?: bigint
}

export interface SwapV3Params {
  tokenIn: Address
  tokenOut: Address
  fee: number
  amountIn: bigint
  amountOutMin: bigint
  sqrtPriceLimitX96?: bigint
  deadline?: bigint
}

// Get default deadline (30 minutes from now)
function getDeadline(customDeadline?: bigint): bigint {
  return customDeadline || BigInt(Math.floor(Date.now() / 1000) + 1800)
}

// V2 Swap: Exact tokens for tokens
export function useSwapV2() {
  const { address } = useAccount()
  const contracts = getXLPContracts(JEJU_CHAIN_ID)

  const { writeContractAsync, isPending, isSuccess, error, data: txHash } = useWriteContract()

  const swapExactTokensForTokens = async (params: SwapV2Params) => {
    if (!address) throw new Error('Wallet not connected')
    if (!contracts?.router) throw new Error('Router not deployed')

    const hash = await writeContractAsync({
      address: contracts.router,
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForTokensV2',
      args: [
        params.amountIn,
        params.amountOutMin,
        params.path,
        address,
        getDeadline(params.deadline),
      ],
    })
    return hash
  }

  const swapExactETHForTokens = async (params: Omit<SwapV2Params, 'amountIn'> & { value: bigint }) => {
    if (!address) throw new Error('Wallet not connected')
    if (!contracts?.router) throw new Error('Router not deployed')

    const hash = await writeContractAsync({
      address: contracts.router,
      abi: ROUTER_ABI,
      functionName: 'swapExactETHForTokensV2',
      args: [params.amountOutMin, params.path, address, getDeadline(params.deadline)],
      value: params.value,
    })
    return hash
  }

  const swapExactTokensForETH = async (params: SwapV2Params) => {
    if (!address) throw new Error('Wallet not connected')
    if (!contracts?.router) throw new Error('Router not deployed')

    const hash = await writeContractAsync({
      address: contracts.router,
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForETHV2',
      args: [
        params.amountIn,
        params.amountOutMin,
        params.path,
        address,
        getDeadline(params.deadline),
      ],
    })
    return hash
  }

  return {
    swapExactTokensForTokens,
    swapExactETHForTokens,
    swapExactTokensForETH,
    isLoading: isPending,
    isSuccess,
    error,
    txHash,
  }
}

// V3 Swap: Single-hop exact input/output
export function useSwapV3() {
  const { address } = useAccount()
  const contracts = getXLPContracts(JEJU_CHAIN_ID)

  const { writeContractAsync, isPending, isSuccess, error, data: txHash } = useWriteContract()

  const exactInputSingle = async (params: SwapV3Params) => {
    if (!address) throw new Error('Wallet not connected')
    if (!contracts?.router) throw new Error('Router not deployed')

    const hash = await writeContractAsync({
      address: contracts.router,
      abi: ROUTER_ABI,
      functionName: 'exactInputSingleV3',
      args: [
        params.tokenIn,
        params.tokenOut,
        params.fee,
        address,
        getDeadline(params.deadline),
        params.amountIn,
        params.amountOutMin,
        params.sqrtPriceLimitX96 || 0n,
      ],
    })
    return hash
  }

  const exactOutputSingle = async (
    params: Omit<SwapV3Params, 'amountIn' | 'amountOutMin'> & {
      amountOut: bigint
      amountInMax: bigint
    }
  ) => {
    if (!address) throw new Error('Wallet not connected')
    if (!contracts?.router) throw new Error('Router not deployed')

    const hash = await writeContractAsync({
      address: contracts.router,
      abi: ROUTER_ABI,
      functionName: 'exactOutputSingleV3',
      args: [
        params.tokenIn,
        params.tokenOut,
        params.fee,
        address,
        getDeadline(params.deadline),
        params.amountOut,
        params.amountInMax,
        params.sqrtPriceLimitX96 || 0n,
      ],
    })
    return hash
  }

  return {
    exactInputSingle,
    exactOutputSingle,
    isLoading: isPending,
    isSuccess,
    error,
    txHash,
  }
}

// Quote V2 swap output
export function useQuoteV2(amountIn: bigint | null, path: Address[]) {
  const contracts = getXLPContracts(JEJU_CHAIN_ID)

  const { data, isLoading, error } = useReadContracts({
    contracts:
      amountIn && path.length >= 2 && contracts?.router
        ? [
            {
              address: contracts.router,
              abi: ROUTER_ABI,
              functionName: 'getAmountsOutV2',
              args: [amountIn, path],
            },
          ]
        : [],
    query: { enabled: !!amountIn && path.length >= 2 && !!contracts?.router },
  })

  const amounts =
    data && data[0]?.status === 'success' ? (data[0].result as bigint[]) : null

  return {
    amountOut: amounts ? amounts[amounts.length - 1] : null,
    amounts,
    isLoading,
    error,
  }
}

// Encode V3 path for multi-hop swaps
export function encodeV3Path(tokens: Address[], fees: number[]): `0x${string}` {
  if (tokens.length !== fees.length + 1) {
    throw new Error('Invalid path: tokens length must be fees length + 1')
  }

  const types: ('address' | 'uint24')[] = []
  const values: (Address | number)[] = []

  for (let i = 0; i < tokens.length; i++) {
    types.push('address')
    values.push(tokens[i])
    if (i < fees.length) {
      types.push('uint24')
      values.push(fees[i])
    }
  }

  return encodePacked(types, values)
}
