'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MarketCard } from '@/components/markets/MarketCard';
import { useMarkets } from '@/hooks/markets/useMarkets';

export default function MarketsPage() {
  const { markets, loading, error } = useMarkets();
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMarkets = markets.filter((market) => {
    const matchesFilter = 
      filter === 'all' || 
      (filter === 'active' && !market.resolved) ||
      (filter === 'resolved' && market.resolved);
    
    const matchesSearch = searchQuery === '' || 
      market.question.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Prediction Markets</h1>
        <p className="text-slate-400 mb-6">
          Trade on real-world outcomes powered by TEE oracles and game data
        </p>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
            <div className="text-sm text-slate-400">Total Volume</div>
            <div className="text-xl font-bold text-white">
              {(markets.reduce((sum, m) => sum + Number(m.totalVolume), 0) / 1e18).toLocaleString()} ETH
            </div>
          </div>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
            <div className="text-sm text-slate-400">Active Markets</div>
            <div className="text-xl font-bold text-white">
              {markets.filter(m => !m.resolved).length}
            </div>
          </div>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
            <div className="text-sm text-slate-400">Total Markets</div>
            <div className="text-xl font-bold text-white">
              {markets.length}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search markets..."
          className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          data-testid="market-search"
        />
        
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            data-testid="filter-all"
          >
            All Markets
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'active'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            data-testid="filter-active"
          >
            Active
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'resolved'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            data-testid="filter-resolved"
          >
            Resolved
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/50 text-red-200">
          <p className="font-semibold mb-2">Failed to load markets</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="markets-grid">
          {filteredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}

      {!loading && !error && filteredMarkets.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-2xl font-semibold mb-2">No Markets Found</h3>
          <p className="text-slate-400 mb-4">
            {searchQuery ? 'No markets match your search' : 'No prediction markets matching your filters'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
            >
              Clear Search
            </button>
          )}
        </div>
      )}
    </div>
  );
}

