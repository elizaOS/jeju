'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { hasV4Periphery } from '@/config/contracts'
import { JEJU_CHAIN_ID } from '@/config/chains'
import { 
  usePools, 
  useCreatePool, 
  formatFee, 
  formatLiquidity,
  sqrtPriceX96ToPrice,
  getFeeTiers,
  getTickSpacing,
  calculateSqrtPriceX96,
  type PoolKey 
} from '@/lib/pools'
import { parseUnits, type Address } from 'viem'
import { toast } from 'sonner'

const MOCK_POOL_KEYS: PoolKey[] = [
  {
    currency0: '0x0000000000000000000000000000000000000000' as Address,
    currency1: '0x1111111111111111111111111111111111111111' as Address,
    fee: 3000,
    tickSpacing: 60,
    hooks: '0x0000000000000000000000000000000000000000' as Address,
  },
]

export default function PoolsPage() {
  const { address, isConnected } = useAccount()
  const hasPeriphery = hasV4Periphery(JEJU_CHAIN_ID)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Fetch existing pools
  const { pools, isLoading: poolsLoading, refetch: refetchPools } = usePools(MOCK_POOL_KEYS)

  // Create pool form state
  const [token0, setToken0] = useState('')
  const [token1, setToken1] = useState('')
  const [selectedFee, setSelectedFee] = useState(3000)
  const [initialPrice, setInitialPrice] = useState('')
  const [hooksAddress, setHooksAddress] = useState('')

  const { createPool, isLoading: isCreating, isSuccess, error: createError } = useCreatePool()

  const handleCreatePool = async () => {
    if (!token0 || !token1 || !initialPrice) {
      toast.error('Please fill in all required fields')
      return
    }

    const tickSpacing = getTickSpacing(selectedFee)
    const amount0 = parseUnits(initialPrice, 18)
    const amount1 = parseUnits('1', 18)
    const sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1)

    await createPool({
      token0: token0 as Address,
      token1: token1 as Address,
      fee: selectedFee,
      tickSpacing,
      hooks: hooksAddress ? (hooksAddress as Address) : undefined,
      sqrtPriceX96,
    })

    toast.success('Pool created successfully!')
    setShowCreateModal(false)
    refetchPools()
    
    setToken0('')
    setToken1('')
    setInitialPrice('')
    setHooksAddress('')
  }

  if (isSuccess) {
    toast.success('Pool created successfully!')
  }

  if (createError) {
    toast.error(`Error: ${createError.message}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">Liquidity Pools</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!isConnected || !hasPeriphery}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ➕ Create Pool
        </button>
      </div>

      {!hasPeriphery && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/50 text-yellow-200 mb-6">
          ⚠️ V4 Periphery contracts not deployed. Pool features unavailable.
        </div>
      )}

      {!isConnected && (
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/50 text-blue-200 mb-6">
          💡 Connect your wallet to create and manage pools
        </div>
      )}

      {/* Pools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {poolsLoading ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            Loading pools...
          </div>
        ) : pools.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-6xl mb-4">🏊</div>
            <h3 className="text-2xl font-semibold mb-2">No Pools Yet</h3>
            <p className="text-slate-400 mb-4">
              Be the first to create a liquidity pool!
            </p>
          </div>
        ) : (
          pools.map((pool) => (
            <div
              key={pool.id}
              className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500" />
                  <div className="w-8 h-8 rounded-full bg-orange-500 -ml-3" />
                  <span className="ml-2 font-semibold">
                    {pool.token0Symbol || 'Token0'}/{pool.token1Symbol || 'Token1'}
                  </span>
                </div>
                <span className="text-sm text-green-400">{formatFee(pool.key.fee)}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <div className="text-slate-400">TVL</div>
                  <div className="font-semibold">{formatLiquidity(pool.liquidity)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Price</div>
                  <div className="font-semibold">
                    {sqrtPriceX96ToPrice(pool.slot0.sqrtPriceX96).toFixed(6)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Tick</div>
                  <div className="font-semibold">{pool.slot0.tick}</div>
                </div>
                <div>
                  <div className="text-slate-400">LP Fee</div>
                  <div className="font-semibold">{formatFee(pool.slot0.lpFee)}</div>
                </div>
              </div>

              {pool.key.hooks !== '0x0000000000000000000000000000000000000000' && (
                <div className="mb-4 p-2 rounded bg-purple-500/10 border border-purple-500/50 text-xs">
                  🪝 Hook: {pool.key.hooks.slice(0, 10)}...
                </div>
              )}

              <Link
                href={`/liquidity?pool=${pool.id}`}
                className="w-full block text-center py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors font-medium"
              >
                Add Liquidity
              </Link>
            </div>
          ))
        )}
      </div>

      {/* Create Pool Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-xl p-6 max-w-md w-full border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Create New Pool</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Token 0 Address</label>
                <input
                  type="text"
                  value={token0}
                  onChange={(e) => setToken0(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Token 1 Address</label>
                <input
                  type="text"
                  value={token1}
                  onChange={(e) => setToken1(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Fee Tier</label>
                <select
                  value={selectedFee}
                  onChange={(e) => setSelectedFee(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                >
                  {getFeeTiers().map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Initial Price (Token1 per Token0)</label>
                <input
                  type="number"
                  value={initialPrice}
                  onChange={(e) => setInitialPrice(e.target.value)}
                  placeholder="1.0"
                  step="0.000001"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  Hooks Contract (Optional)
                </label>
                <input
                  type="text"
                  value={hooksAddress}
                  onChange={(e) => setHooksAddress(e.target.value)}
                  placeholder="0x... (leave empty for no hooks)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Add custom hooks for TWAMM, limit orders, dynamic fees, etc.
                </p>
              </div>

              <button
                onClick={handleCreatePool}
                disabled={isCreating || !token0 || !token1 || !initialPrice}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating Pool...' : 'Create Pool'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
