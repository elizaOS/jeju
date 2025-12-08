'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { parseEther, formatEther, type Address } from 'viem'
import { hasV4Periphery, getV4Contracts } from '@/config/contracts'
import { JEJU_CHAIN_ID } from '@/config/chains'
import { toast } from 'sonner'
import { 
  useEILConfig, 
  useCrossChainSwap, 
  useSwapFeeEstimate,
  SUPPORTED_CHAINS,
  requiresCrossChainSwap 
} from '@/hooks/useEIL'

const TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address },
  { symbol: 'USDC', name: 'USD Coin', address: '0x0000000000000000000000000000000000000001' as Address },
  { symbol: 'elizaOS', name: 'elizaOS Token', address: '0x0000000000000000000000000000000000000002' as Address },
]

export default function SwapPage() {
  const { isConnected, chain, address } = useAccount()
  const [inputAmount, setInputAmount] = useState('')
  const [outputAmount, setOutputAmount] = useState('')
  const [inputToken, setInputToken] = useState('ETH')
  const [outputToken, setOutputToken] = useState('USDC')
  const [sourceChainId, setSourceChainId] = useState(JEJU_CHAIN_ID)
  const [destChainId, setDestChainId] = useState(JEJU_CHAIN_ID)
  const [showCrossChain, setShowCrossChain] = useState(false)

  const hasPeriphery = hasV4Periphery(JEJU_CHAIN_ID)
  const isCorrectChain = chain?.id === JEJU_CHAIN_ID
  const contracts = hasPeriphery ? getV4Contracts(JEJU_CHAIN_ID) : null

  const { isAvailable: eilAvailable, crossChainPaymaster } = useEILConfig()
  const { executeCrossChainSwap, swapStatus, isLoading: isCrossChainLoading, hash } = useCrossChainSwap(crossChainPaymaster)
  
  const isCrossChain = requiresCrossChainSwap(sourceChainId, destChainId)
  const amount = inputAmount ? parseEther(inputAmount) : BigInt(0)
  const feeEstimate = useSwapFeeEstimate(sourceChainId, destChainId, amount)

  const sourceChain = SUPPORTED_CHAINS.find(c => c.id === sourceChainId)
  const destChain = SUPPORTED_CHAINS.find(c => c.id === destChainId)

  const handleSwap = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error('Please enter an amount')
      return
    }

    if (inputToken === outputToken && !isCrossChain) {
      toast.error('Cannot swap same token on same chain')
      return
    }

    // Cross-chain swap via EIL
    if (isCrossChain) {
      if (!eilAvailable) {
        toast.error('Cross-chain swaps not available')
        return
      }

      const sourceTokenInfo = TOKENS.find(t => t.symbol === inputToken)
      const destTokenInfo = TOKENS.find(t => t.symbol === outputToken)

      if (!sourceTokenInfo || !destTokenInfo) {
        toast.error('Token not found')
        return
      }

      toast.info('Initiating cross-chain swap via EIL...', {
        description: `${sourceChain?.icon} → ${destChain?.icon} using trustless atomic swap`
      })

      await executeCrossChainSwap({
        sourceToken: sourceTokenInfo.address,
        destinationToken: destTokenInfo.address,
        amount: parseEther(inputAmount),
        sourceChainId,
        destinationChainId: destChainId
      })

      return
    }

    // Same-chain swap via Uniswap V4
    if (!isCorrectChain) {
      toast.error('Please switch to Jeju network')
      return
    }

    if (!contracts?.swapRouter) {
      toast.error('Swap router not configured')
      return
    }

    toast.info('Swap functionality coming soon', {
      description: 'V4 swap router integration in progress'
    })
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-4xl font-bold mb-4">Swap Tokens</h1>
      
      {/* EIL Banner */}
      {eilAvailable && (
        <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold text-blue-300">EIL Enabled</span>
          </div>
          <p className="text-sm text-slate-300">
            Cross-chain swaps available via Ethereum Interop Layer. No bridges, no waiting.
          </p>
        </div>
      )}

      {!hasPeriphery && !eilAvailable && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/50 text-yellow-200 mb-6">
          ⚠️ Swap functionality unavailable. Neither V4 nor EIL contracts are deployed.
        </div>
      )}

      {isConnected && !isCorrectChain && !isCrossChain && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-200 mb-6">
          ❌ Please switch to Jeju network (Chain ID: {JEJU_CHAIN_ID})
        </div>
      )}

      <div className="p-6 rounded-xl bg-white/5 border border-white/10">
        {/* Cross-Chain Toggle */}
        {eilAvailable && (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-slate-400">Cross-Chain Mode</span>
            <button
              onClick={() => setShowCrossChain(!showCrossChain)}
              className={`px-4 py-1 rounded-full text-sm transition-all ${
                showCrossChain 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {showCrossChain ? 'ON' : 'OFF'}
            </button>
          </div>
        )}

        {/* Chain Selectors (Cross-Chain Mode) */}
        {showCrossChain && (
          <div className="grid grid-cols-2 gap-4 mb-4 p-4 rounded-lg bg-white/5">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">From Chain</label>
              <select
                value={sourceChainId}
                onChange={(e) => setSourceChainId(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {SUPPORTED_CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.icon} {chain.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">To Chain</label>
              <select
                value={destChainId}
                onChange={(e) => setDestChainId(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {SUPPORTED_CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.icon} {chain.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Input Token */}
        <div className="mb-4">
          <label className="text-sm text-slate-400 mb-2 block">From</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-purple-500"
            />
            <select
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
            >
              {TOKENS.map((token) => (
                <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap Icon */}
        <div className="flex justify-center my-2">
          <button 
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => {
              setInputToken(outputToken)
              setOutputToken(inputToken)
              if (showCrossChain) {
                const temp = sourceChainId
                setSourceChainId(destChainId)
                setDestChainId(temp)
              }
            }}
          >
            ↓
          </button>
        </div>

        {/* Output Token */}
        <div className="mb-6">
          <label className="text-sm text-slate-400 mb-2 block">To</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={outputAmount}
              placeholder="0.0"
              readOnly
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-lg focus:outline-none"
            />
            <select
              value={outputToken}
              onChange={(e) => setOutputToken(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
            >
              {TOKENS.map((token) => (
                <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cross-Chain Info */}
        {isCrossChain && (
          <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span>⚡</span>
              <span className="text-sm font-medium text-blue-300">EIL Cross-Chain Swap</span>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Route</span>
                <span>{sourceChain?.icon} → {destChain?.icon}</span>
              </div>
              <div className="flex justify-between">
                <span>Est. Time</span>
                <span className="text-green-400">~{feeEstimate.estimatedTime}s</span>
              </div>
              <div className="flex justify-between">
                <span>Network Fee</span>
                <span>{formatEther(feeEstimate.totalFee)} ETH</span>
              </div>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={
            !isConnected || 
            isCrossChainLoading ||
            (!hasPeriphery && !isCrossChain) || 
            (!isCorrectChain && !isCrossChain)
          }
          className="w-full py-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!isConnected
            ? 'Connect Wallet'
            : isCrossChainLoading
            ? 'Processing...'
            : isCrossChain
            ? `Swap via EIL`
            : !isCorrectChain
            ? 'Switch to Jeju'
            : !hasPeriphery
            ? 'Contracts Not Deployed'
            : 'Swap'}
        </button>

        {/* Transaction Status */}
        {swapStatus === 'complete' && hash && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-1">
              <span>✓</span>
              <span className="text-sm font-medium text-green-300">Swap Initiated!</span>
            </div>
            <p className="text-xs text-slate-400">
              XLP is fulfilling your request. Funds will arrive in ~10 seconds.
            </p>
          </div>
        )}
      </div>

      {/* Pool Info (if available) */}
      {(hasPeriphery || isCrossChain) && (
        <div className="mt-6 p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Rate</span>
            <span>1 ETH = 3000 USDC</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Price Impact</span>
            <span className="text-green-400">&lt; 0.01%</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Protocol</span>
            <span className={isCrossChain ? 'text-blue-400' : 'text-purple-400'}>
              {isCrossChain ? 'EIL (Trustless)' : 'Uniswap V4'}
            </span>
          </div>
          {isCrossChain && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Security</span>
              <span className="text-green-400">L1 Stake-backed</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
