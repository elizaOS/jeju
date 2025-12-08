import { useWriteContract, useReadContracts, useAccount } from 'wagmi'
import { getV4Contracts } from '@/config/contracts'
import { JEJU_CHAIN_ID } from '@/config/chains'
import PositionManagerABI from '../abis/PositionManager.json'
import { Position, AddLiquidityParams, RemoveLiquidityParams, PoolKey } from './types'
import { computePoolId } from './utils'
import type { Abi } from 'viem'

const POSITION_MANAGER_ABI = PositionManagerABI as Abi

export function useAddLiquidity() {
  const contracts = getV4Contracts(JEJU_CHAIN_ID)

  const {
    writeContractAsync: mintPosition,
    data: txHash,
    isPending,
    isSuccess,
    error,
  } = useWriteContract()

  const addLiquidity = async (params: AddLiquidityParams) => {
    if (!contracts.positionManager) {
      throw new Error('Position manager contract not deployed')
    }

    const hash = await mintPosition({
      address: contracts.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: 'mint',
      args: [
        params.poolKey,
        params.tickLower,
        params.tickUpper,
        params.liquidity,
        params.amount0Max,
        params.amount1Max,
        params.recipient,
        params.deadline,
      ],
      value: 0n,
    })
    return hash || ('0x' as `0x${string}`)
  }

  return {
    addLiquidity,
    isLoading: isPending,
    isSuccess,
    error,
    txHash,
  }
}

export function useRemoveLiquidity() {
  const contracts = getV4Contracts(JEJU_CHAIN_ID)

  const {
    writeContractAsync: burnPosition,
    data: txHash,
    isPending,
    isSuccess,
    error,
  } = useWriteContract()

  const removeLiquidity = async (params: RemoveLiquidityParams) => {
    if (!contracts.positionManager) {
      throw new Error('Position manager contract not deployed')
    }

    const hash = await burnPosition({
      address: contracts.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: 'burn',
      args: [
        params.tokenId,
        params.liquidity,
        params.amount0Min,
        params.amount1Min,
        params.deadline,
      ],
    })
    return hash || ('0x' as `0x${string}`)
  }

  return {
    removeLiquidity,
    isLoading: isPending,
    isSuccess,
    error,
    txHash,
  }
}

export function usePositions(_poolKey?: PoolKey) {
  const { address } = useAccount()

  const { isLoading, error, refetch } = useReadContracts({
    contracts: [],
    query: { enabled: !!address },
  })

  const positions: Position[] = []

  return { positions, isLoading, error, refetch }
}

export function usePosition(tokenId: bigint | null, poolKey: PoolKey | null) {
  const { address } = useAccount()
  const contracts = getV4Contracts(JEJU_CHAIN_ID)
  const poolId = poolKey ? computePoolId(poolKey) : null

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts:
      tokenId && poolId && address
        ? [
            {
              address: contracts.positionManager,
              abi: POSITION_MANAGER_ABI,
              functionName: 'getPosition',
              args: [poolId, address, 0, 0, '0x0000000000000000000000000000000000000000000000000000000000000000'],
            },
          ]
        : [],
    query: { enabled: !!tokenId && !!poolId && !!address },
  })

  if (!data || data.length === 0 || !poolKey || !tokenId) {
    return { position: null, isLoading, error, refetch }
  }

  const positionData = data[0]
  if (positionData.status !== 'success') {
    return { position: null, isLoading, error: error || new Error('Failed to fetch position'), refetch }
  }

  const [liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128] = positionData.result as [
    bigint,
    bigint,
    bigint
  ]

  const position: Position = {
    tokenId,
    poolId: computePoolId(poolKey),
    owner: address!,
    tickLower: 0, // Would need to be stored/provided
    tickUpper: 0, // Would need to be stored/provided
    liquidity,
  }

  return { position, isLoading, error, refetch }
}

export function useCalculateAmounts(
  _poolKey: PoolKey | null,
  _liquidity: bigint,
  _tickLower: number,
  _tickUpper: number
) {
  return { amount0: 0n, amount1: 0n, isLoading: false, error: null }
}

export function useCollectFees(tokenId: bigint | null) {
  const contracts = getV4Contracts(JEJU_CHAIN_ID)

  const {
    writeContractAsync: collect,
    data: txHash,
    isPending,
    isSuccess,
    error,
  } = useWriteContract()

  const collectFees = async () => {
    if (!tokenId) throw new Error('No token ID provided')
    if (!contracts.positionManager) {
      throw new Error('Position manager contract not deployed')
    }
    
    const hash = await collect({
      address: contracts.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: 'burn',
      args: [tokenId, 0n, 0n, 0n, BigInt(Math.floor(Date.now() / 1000) + 1800)],
    })
    return hash || ('0x' as `0x${string}`)
  }

  return {
    collectFees,
    isLoading: isPending,
    isSuccess,
    error,
    txHash,
  }
}

