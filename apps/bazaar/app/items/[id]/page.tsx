'use client'

import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useState } from 'react'

export default function NFTDetailPage() {
  const params = useParams()
  const { address, isConnected } = useAccount()
  const [showListModal, setShowListModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)

  // Parse ID: format is nftContract-tokenId
  const id = params.id as string
  const [nftContract, tokenId] = id?.split('-') || []

  const isOwner = true // TODO: Check actual ownership

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* NFT Image */}
        <div className="rounded-xl overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 aspect-square flex items-center justify-center text-8xl">
          🖼️
        </div>

        {/* NFT Info */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Item #{tokenId}</h1>
          <p className="text-slate-400 mb-6">Collection: {nftContract?.slice(0, 6)}...</p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Owner</span>
                <span className="font-mono text-sm">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Token ID</span>
                <span>{tokenId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Contract</span>
                <span className="font-mono text-xs">
                  {nftContract?.slice(0, 6)}...{nftContract?.slice(-4)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {isConnected && isOwner && (
            <div className="space-y-3">
              <button
                onClick={() => setShowListModal(true)}
                className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold transition-all"
                data-testid="list-item-button"
              >
                List for Sale
              </button>
              <button
                onClick={() => setShowTransferModal(true)}
                className="w-full px-6 py-4 rounded-lg bg-white/10 hover:bg-white/20 font-bold transition-all"
                data-testid="transfer-item-button"
              >
                Transfer Item
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Activity</h2>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <p className="text-slate-400 text-center py-8">
            Activity history will appear here (transfers, sales, bids)
          </p>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-8 max-w-md w-full border border-white/10">
            <h2 className="text-2xl font-bold mb-6">Transfer Item</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                  data-testid="transfer-address-input"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition"
              >
                Cancel
              </button>
              <button
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold transition-all"
                data-testid="confirm-transfer-button"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

