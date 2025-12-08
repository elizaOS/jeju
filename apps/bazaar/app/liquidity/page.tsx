'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAccount } from 'wagmi'
import { useSearchParams } from 'next/navigation'
import { hasV4Periphery } from '@/config/contracts'
import { JEJU_CHAIN_ID } from '@/config/chains'
import {
  useAddLiquidity,
  useRemoveLiquidity,
  usePositions,
  usePool,
  createPoolKey,
  formatLiquidity,
  sqrtPriceX96ToPrice,
  priceToTick,
  tickToPrice,
  type PoolKey,
} from '@/lib/pools'
import { parseUnits, parseEther, formatEther, type Address } from 'viem'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useEILConfig, SUPPORTED_CHAINS } from '@/hooks/useEIL'

function LiquidityPageContent() {
  const { address, isConnected, chain } = useAccount()
  const searchParams = useSearchParams()
  const poolIdFromUrl = searchParams.get('pool')

  const [token0Address, setToken0Address] = useState('')
  const [token1Address, setToken1Address] = useState('')
  const [fee, setFee] = useState(3000)
  const [token0Amount, setToken0Amount] = useState('')
  const [token1Amount, setToken1Amount] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [selectedPosition, setSelectedPosition] = useState<bigint | null>(null)
  const [removeAmount, setRemoveAmount] = useState('')
  const [activeSection, setActiveSection] = useState<'v4' | 'xlp'>('v4')

  const hasPeriphery = hasV4Periphery(JEJU_CHAIN_ID)
  const isCorrectChain = chain?.id === JEJU_CHAIN_ID
  const { isAvailable: eilAvailable } = useEILConfig()

  // Create pool key from inputs
  const poolKey: PoolKey | null = token0Address && token1Address
    ? createPoolKey(
        token0Address as Address,
        token1Address as Address,
        fee,
        60 // Default tick spacing
      )
    : null

  // Fetch pool data
  const { pool, isLoading: poolLoading } = usePool(poolKey)

  // Fetch user positions
  const { positions, refetch: refetchPositions } = usePositions(poolKey || undefined)

  // Liquidity operations
  const { addLiquidity, isLoading: isAdding, isSuccess: addSuccess } = useAddLiquidity()
  const { removeLiquidity, isLoading: isRemoving, isSuccess: removeSuccess } = useRemoveLiquidity()

  useEffect(() => {
    if (addSuccess) {
      toast.success('Liquidity added successfully!')
      refetchPositions()
      setToken0Amount('')
      setToken1Amount('')
    }
  }, [addSuccess, refetchPositions])

  useEffect(() => {
    if (removeSuccess) {
      toast.success('Liquidity removed successfully!')
      refetchPositions()
      setRemoveAmount('')
      setSelectedPosition(null)
    }
  }, [removeSuccess, refetchPositions])

  const handleAddLiquidity = async () => {
    if (!poolKey || !token0Amount || !token1Amount || !minPrice || !maxPrice) {
      toast.error('Please fill in all fields')
      return
    }

    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    const amount0 = parseUnits(token0Amount, 18)
    const amount1 = parseUnits(token1Amount, 18)
    const tickLower = priceToTick(parseFloat(minPrice))
    const tickUpper = priceToTick(parseFloat(maxPrice))
    const liquidity = amount0 > amount1 ? amount0 : amount1

    await addLiquidity({
      poolKey,
      tickLower,
      tickUpper,
      liquidity,
      amount0Max: amount0,
      amount1Max: amount1,
      recipient: address,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
    })
  }

  const handleRemoveLiquidity = async () => {
    if (!selectedPosition || !removeAmount) {
      toast.error('Please select a position and enter amount')
      return
    }

    const liquidity = parseUnits(removeAmount, 18)

    await removeLiquidity({
      tokenId: selectedPosition,
      liquidity: liquidity as unknown as bigint,
      amount0Min: 0n,
      amount1Min: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
    })
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-4">Manage Liquidity</h1>
      <p className="text-slate-400 mb-8">Provide liquidity for same-chain swaps (V4) or cross-chain transfers (XLP)</p>

      {/* Section Toggle */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setActiveSection('v4')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeSection === 'v4'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          🔄 Uniswap V4 Pools
        </button>
        <button
          onClick={() => setActiveSection('xlp')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeSection === 'xlp'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          ⚡ Cross-Chain XLP
        </button>
      </div>

      {/* XLP Section */}
      {activeSection === 'xlp' && (
        <div className="mb-8">
          <div className="p-6 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">⚡</span>
              <div>
                <h2 className="text-xl font-bold text-blue-300">Become an XLP</h2>
                <p className="text-sm text-slate-400">Earn fees by providing cross-chain liquidity</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-2xl mb-1">1</div>
                <div className="font-semibold mb-1">Stake on L1</div>
                <div className="text-sm text-slate-400">Min 1 ETH stake for security</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-2xl mb-1">2</div>
                <div className="font-semibold mb-1">Deposit Liquidity</div>
                <div className="text-sm text-slate-400">Add ETH/tokens on supported chains</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-2xl mb-1">3</div>
                <div className="font-semibold mb-1">Fulfill Transfers</div>
                <div className="text-sm text-slate-400">Earn fees on every cross-chain swap</div>
              </div>
            </div>
            <p className="text-sm text-slate-400">
              <strong>Security:</strong> Your stake is slashed if you fail to fulfill vouchers. 8-day unbonding period.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Supported Chains */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-xl font-semibold mb-4">Supported Chains</h3>
              <div className="grid grid-cols-2 gap-4">
                {SUPPORTED_CHAINS.map((chain) => (
                  <div key={chain.id} className="p-4 rounded-lg bg-white/5 text-center">
                    <div className="text-2xl mb-2">{chain.icon}</div>
                    <div className="font-semibold">{chain.name}</div>
                    <div className="text-sm text-green-400">Active</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-4">
                <a 
                  href="https://gateway.jeju.network?tab=xlp" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-all"
                >
                  <div className="font-semibold text-blue-300 mb-1">🌊 Register as XLP</div>
                  <div className="text-sm text-slate-400">Stake ETH and start earning cross-chain fees</div>
                </a>
                <a 
                  href="https://gateway.jeju.network?tab=xlp" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all"
                >
                  <div className="font-semibold text-green-300 mb-1">💰 Deposit Liquidity</div>
                  <div className="text-sm text-slate-400">Add ETH or tokens to start fulfilling transfers</div>
                </a>
                <a 
                  href="https://gateway.jeju.network?tab=transfer" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-all"
                >
                  <div className="font-semibold text-purple-300 mb-1">⚡ Try Cross-Chain Transfer</div>
                  <div className="text-sm text-slate-400">Experience instant, trustless transfers</div>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* V4 Section */}
      {activeSection === 'v4' && (
        <>
          {!hasPeriphery && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/50 text-yellow-200 mb-6">
              ⚠️ V4 Periphery contracts not deployed. Liquidity features unavailable.
            </div>
          )}

          {isConnected && !isCorrectChain && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-200 mb-6">
              ❌ Please switch to Jeju network (Chain ID: {JEJU_CHAIN_ID})
            </div>
          )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Add Liquidity Section */}
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h2 className="text-2xl font-semibold mb-6">Add Liquidity</h2>

          {/* Pool Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Select Pool</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Token 0 Address</label>
                <input
                  type="text"
                  value={token0Address}
                  onChange={(e) => setToken0Address(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Token 1 Address</label>
                <input
                  type="text"
                  value={token1Address}
                  onChange={(e) => setToken1Address(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Fee Tier</label>
                <select
                  value={fee}
                  onChange={(e) => setFee(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                >
                  <option value={100}>0.01%</option>
                  <option value={500}>0.05%</option>
                  <option value={3000}>0.3%</option>
                  <option value={10000}>1%</option>
                </select>
              </div>
            </div>

            {pool && (
              <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/50">
                <div className="text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">Current Price:</span>
                    <span className="font-semibold">
                      {sqrtPriceX96ToPrice(pool.slot0.sqrtPriceX96).toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Liquidity:</span>
                    <span className="font-semibold">{formatLiquidity(pool.liquidity)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Token Amounts */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Deposit Amounts</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Token 0 Amount</label>
                <input
                  type="number"
                  value={token0Amount}
                  onChange={(e) => setToken0Amount(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Token 1 Amount</label>
                <input
                  type="number"
                  value={token1Amount}
                  onChange={(e) => setToken1Amount(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Price Range */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Set Price Range</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Min Price</label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Max Price</label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Your liquidity will only be active within this price range
            </p>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddLiquidity}
            disabled={!isConnected || !hasPeriphery || !isCorrectChain || isAdding}
            className="w-full py-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!isConnected
              ? 'Connect Wallet'
              : !isCorrectChain
              ? 'Switch to Jeju'
              : !hasPeriphery
              ? 'Contracts Not Deployed'
              : isAdding
              ? 'Adding Liquidity...'
              : 'Add Liquidity'}
          </button>
        </div>

        {/* Positions & Remove Liquidity Section */}
        <div className="space-y-6">
          {/* User Positions */}
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-2xl font-semibold mb-4">Your Positions</h2>
            
            {!isConnected ? (
              <div className="text-center py-8 text-slate-400">
                Connect wallet to view positions
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-slate-400">No positions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {positions.map((position) => (
                  <div
                    key={position.tokenId.toString()}
                    onClick={() => setSelectedPosition(position.tokenId)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedPosition === position.tokenId
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Position #{position.tokenId.toString()}</span>
                      <span className="text-sm text-green-400">Active</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-slate-400">Liquidity</div>
                        <div className="font-semibold">{formatLiquidity(position.liquidity)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Range</div>
                        <div className="font-semibold">
                          {tickToPrice(position.tickLower).toFixed(4)} - {tickToPrice(position.tickUpper).toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Remove Liquidity */}
          {selectedPosition && (
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h2 className="text-2xl font-semibold mb-4">Remove Liquidity</h2>
              
              <div className="mb-4">
                <label className="text-sm text-slate-400 mb-2 block">
                  Amount to Remove
                </label>
                <input
                  type="number"
                  value={removeAmount}
                  onChange={(e) => setRemoveAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setRemoveAmount('25')}
                    className="flex-1 px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-sm"
                  >
                    25%
                  </button>
                  <button
                    onClick={() => setRemoveAmount('50')}
                    className="flex-1 px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-sm"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setRemoveAmount('75')}
                    className="flex-1 px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-sm"
                  >
                    75%
                  </button>
                  <button
                    onClick={() => setRemoveAmount('100')}
                    className="flex-1 px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-sm"
                  >
                    100%
                  </button>
                </div>
              </div>

              <button
                onClick={handleRemoveLiquidity}
                disabled={!removeAmount || isRemoving}
                className="w-full py-4 rounded-lg bg-red-600 hover:bg-red-500 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRemoving ? 'Removing Liquidity...' : 'Remove Liquidity'}
              </button>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  )
}

export default function LiquidityPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>}>
      <LiquidityPageContent />
    </Suspense>
  )
}
