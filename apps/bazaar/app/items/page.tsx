'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { hasNFTMarketplace } from '@/config/contracts'
import { JEJU_CHAIN_ID } from '@/config/chains'
import { request, gql } from 'graphql-request'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:4350/graphql'

const NFT_QUERY = gql`
  query GetNFTs($owner: String) {
    erc721Tokens(limit: 100, orderBy: tokenId_DESC) {
      id
      tokenId
      owner {
        address
      }
      contract {
        address
        name
      }
      metadata
    }
    erc1155Balances(where: { balance_gt: "0", account: { address_eq: $owner } }, limit: 100) {
      id
      tokenId
      balance
      contract {
        address
        name
      }
    }
  }
`

interface NFTToken {
  id: string
  tokenId: string
  owner?: { address: string }
  contract?: { address: string; name: string }
  metadata?: string
}

interface NFTBalance {
  id: string
  tokenId: string
  balance: string
  contract?: { address: string; name: string }
}

interface NFTQueryResult {
  erc721Tokens: NFTToken[]
  erc1155Balances: NFTBalance[]
}

interface NormalizedNFT {
  id: string
  tokenId: string
  owner?: string
  balance?: string
  contract?: string
  contractName: string
  type: 'ERC721' | 'ERC1155'
  metadata?: string
}

function NFTsPageContent() {
  const { address, isConnected } = useAccount()
  const searchParams = useSearchParams()
  const [filter, setFilter] = useState<'all' | 'my-nfts'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'price' | 'collection'>('recent')
  const [showListModal, setShowListModal] = useState(false)
  const [selectedNFT, setSelectedNFT] = useState<NormalizedNFT | null>(null)
  const [reservePrice, setReservePrice] = useState('')
  const [duration, setDuration] = useState('86400')
  const [buyoutPrice, setBuyoutPrice] = useState('')

  const hasMarketplace = hasNFTMarketplace(JEJU_CHAIN_ID)

  // Read filter from URL parameter
  useEffect(() => {
    const urlFilter = searchParams?.get('filter')
    if (urlFilter === 'my-nfts') {
      setFilter('my-nfts')
    }
  }, [searchParams])

  const { data: nftData, isLoading } = useQuery<NFTQueryResult>({
    queryKey: ['nfts', filter === 'my-nfts' ? address : null],
    queryFn: async () => {
      const data = await request<NFTQueryResult>(INDEXER_URL, NFT_QUERY, {
        owner: filter === 'my-nfts' ? address?.toLowerCase() : undefined
      })
      return data
    },
    enabled: filter === 'all' || (filter === 'my-nfts' && !!address),
    refetchInterval: 10000,
  })

  const allNFTs: NormalizedNFT[] = [
    ...(nftData?.erc721Tokens || []).map((token) => ({
      id: token.id,
      tokenId: token.tokenId,
      owner: token.owner?.address,
      contract: token.contract?.address,
      contractName: token.contract?.name || 'Unknown',
      type: 'ERC721' as const,
      metadata: token.metadata,
    })),
    ...(nftData?.erc1155Balances || []).map((balance) => ({
      id: balance.id,
      tokenId: balance.tokenId,
      balance: balance.balance,
      contract: balance.contract?.address,
      contractName: balance.contract?.name || 'Unknown',
      type: 'ERC1155' as const,
    }))
  ]

  const filteredNFTs = filter === 'my-nfts' 
    ? allNFTs.filter(nft => nft.owner?.toLowerCase() === address?.toLowerCase() || Number(nft.balance) > 0)
    : allNFTs

  const sortedNFTs = [...filteredNFTs].sort((a, b) => {
    switch (sortBy) {
      case 'collection':
        return a.contractName.localeCompare(b.contractName)
      case 'recent':
        return parseInt(b.tokenId || '0') - parseInt(a.tokenId || '0')
      case 'price':
        return 0
      default:
        return 0
    }
  })

  const collections = sortedNFTs.reduce((acc, nft) => {
    const collection = nft.contractName
    if (!acc[collection]) acc[collection] = []
    acc[collection].push(nft)
    return acc
  }, {} as Record<string, NormalizedNFT[]>)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Items</h1>
        <p className="text-slate-400 mb-6">
          Browse and trade Items
        </p>

        {!hasMarketplace && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/50 text-yellow-200 mb-6">
            ⚠️ NFT Marketplace contracts not deployed. Marketplace features unavailable.
          </div>
        )}

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* View Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
              data-testid="filter-all-nfts"
            >
              All Items
            </button>
            <button
              onClick={() => setFilter('my-nfts')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'my-nfts'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
              data-testid="filter-my-nfts"
              disabled={!isConnected}
            >
              My Items {!isConnected && '(Connect Wallet)'}
            </button>
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'price' | 'collection')}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
            data-testid="nft-sort-select"
          >
            <option value="recent">Recently Listed</option>
            <option value="price">Price: Low to High</option>
            <option value="collection">By Collection</option>
          </select>

          {/* List NFT Button (only when viewing My Items) */}
          {filter === 'my-nfts' && isConnected && sortedNFTs.length > 0 && (
            <button
              onClick={() => setShowListModal(true)}
              className="ml-auto px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold transition-all"
              data-testid="list-for-auction-button"
            >
              List for Auction
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
        </div>
      )}

      {/* NFT Grid */}
      {!isLoading && sortedNFTs.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🖼️</div>
          <h3 className="text-2xl font-semibold mb-2">
            {filter === 'my-nfts' ? 'No Items in Your Collection' : 'No Items Found'}
          </h3>
          <p className="text-slate-400 mb-6">
            {filter === 'my-nfts' 
              ? "You don't own any Items on Jeju yet."
              : 'No Items have been minted yet.'}
          </p>
        </div>
      )}

      {!isLoading && sortedNFTs.length > 0 && (
        <div className="space-y-8">
          {Object.entries(collections).map(([collectionName, nfts]) => (
            <div key={collectionName}>
              <h2 className="text-2xl font-bold mb-4">{collectionName}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {nfts.map((nft) => (
                  <div
                    key={nft.id}
                    className="rounded-xl bg-white/5 border border-white/10 overflow-hidden hover:scale-105 transition-all cursor-pointer"
                    data-testid="nft-card"
                    onClick={() => setSelectedNFT(nft)}
                  >
                    <div className="aspect-square bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-6xl">
                      🖼️
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-1">#{nft.tokenId}</h3>
                      <p className="text-sm text-slate-400 mb-3">{nft.contractName}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Owner</span>
                        <span className="font-mono text-xs">
                          {nft.owner?.slice(0, 6)}...{nft.owner?.slice(-4)}
                        </span>
                      </div>
                      {nft.type === 'ERC1155' && nft.balance && (
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span className="text-slate-400">Quantity</span>
                          <span className="font-semibold">{nft.balance}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NFT Detail Modal */}
      {selectedNFT && !showListModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setSelectedNFT(null)}>
          <div className="bg-slate-900 rounded-xl p-8 max-w-md w-full border border-white/10" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4">#{selectedNFT.tokenId}</h2>
            <p className="text-slate-400 mb-4">{selectedNFT.contractName}</p>
            
            <div className="aspect-square bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-8xl mb-4">
              🖼️
            </div>
            
            <div className="space-y-2 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Contract</span>
                <span className="font-mono">{selectedNFT.contract?.slice(0, 10)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Type</span>
                <span>{selectedNFT.type}</span>
              </div>
              {selectedNFT.owner && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Owner</span>
                  <span className="font-mono">{selectedNFT.owner.slice(0, 10)}...</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedNFT(null)}
                className="flex-1 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition"
              >
                Close
              </button>
              {selectedNFT.owner?.toLowerCase() === address?.toLowerCase() && (
                <button
                  onClick={() => setShowListModal(true)}
                  className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold transition-all"
                >
                  List for Sale
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List for Auction Modal */}
      {showListModal && selectedNFT && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-8 max-w-md w-full border border-white/10">
            <h2 className="text-2xl font-bold mb-2">List NFT for Auction</h2>
            <p className="text-slate-400 mb-6">#{selectedNFT.tokenId} - {selectedNFT.contractName}</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Reserve Price (ETH)
                </label>
                <input
                  type="number"
                  value={reservePrice}
                  onChange={(e) => setReservePrice(e.target.value)}
                  placeholder="0.1"
                  step="0.001"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                  data-testid="reserve-price-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Duration
                </label>
                <select 
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="86400">1 Day</option>
                  <option value="259200">3 Days</option>
                  <option value="604800">7 Days</option>
                  <option value="1209600">14 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Instant Buy Price (Optional)
                </label>
                <input
                  type="number"
                  value={buyoutPrice}
                  onChange={(e) => setBuyoutPrice(e.target.value)}
                  placeholder="1.0"
                  step="0.001"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowListModal(false)
                  setReservePrice('')
                  setBuyoutPrice('')
                }}
                className="flex-1 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Call useNFTAuction.createAuction with selectedNFT and form values
                  setShowListModal(false)
                  setSelectedNFT(null)
                  setReservePrice('')
                  setBuyoutPrice('')
                }}
                disabled={!reservePrice || parseFloat(reservePrice) <= 0}
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold transition-all disabled:opacity-50"
                data-testid="confirm-list-button"
              >
                List NFT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NFTsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>}>
      <NFTsPageContent />
    </Suspense>
  )
}
