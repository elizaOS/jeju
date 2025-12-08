'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { TradingInterface } from '@/components/markets/TradingInterface';
import { MarketChart } from '@/components/markets/MarketChart';
import { useMarket } from '@/hooks/markets/useMarket';
import { useClaim } from '@/hooks/markets/useClaim';
import { formatDistanceToNow } from 'date-fns';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface PageProps {
  params: { id: string };
}

function ClaimButton({ sessionId }: { sessionId: string }) {
  const { claim, isPending } = useClaim(sessionId);
  
  return (
    <button 
      onClick={claim}
      disabled={isPending}
      className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition"
    >
      {isPending ? 'Claiming...' : 'Claim Winnings'}
    </button>
  );
}

export default function MarketPage({ params }: PageProps) {
  const { id } = params;
  const { address } = useAccount();
  const { market, loading, error } = useMarket(id);
  const [selectedTab, setSelectedTab] = useState<'trade' | 'activity'>('trade');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-2xl font-semibold mb-2">Market Not Found</h2>
        <p className="text-slate-400">
          This market doesn't exist or hasn't been indexed yet
        </p>
      </div>
    );
  }

  const yesPercent = Number(market.yesPrice) / 1e16;
  const noPercent = Number(market.noPrice) / 1e16;

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-white">
            {market.question}
          </h1>
          {market.resolved ? (
            <span className="px-4 py-2 bg-white/10 text-slate-400 rounded-lg font-medium">
              Resolved
            </span>
          ) : (
            <span className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg font-medium">
              Active
            </span>
          )}
        </div>
        <div className="flex gap-6 text-sm text-slate-400">
          <span>Created {formatDistanceToNow(market.createdAt, { addSuffix: true })}</span>
          <span>•</span>
          <span>Volume: {(Number(market.totalVolume) / 1e18).toLocaleString()} ETH</span>
          {market.resolved && market.outcome !== undefined && (
            <>
              <span>•</span>
              <span className={market.outcome ? 'text-green-400' : 'text-red-400'}>
                Outcome: {market.outcome ? 'YES' : 'NO'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Price History</h2>
            <MarketChart marketId={market.sessionId} />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl">
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setSelectedTab('trade')}
                className={`flex-1 px-6 py-4 font-medium transition ${
                  selectedTab === 'trade'
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Recent Activity
              </button>
              <button
                onClick={() => setSelectedTab('activity')}
                className={`flex-1 px-6 py-4 font-medium transition ${
                  selectedTab === 'activity'
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Your Position
              </button>
            </div>
            <div className="p-6">
              {selectedTab === 'trade' ? (
                <div className="text-slate-400 text-center py-8">
                  Recent trading activity will appear here
                </div>
              ) : (
                <div className="space-y-4">
                  {address ? (
                    <div className="text-slate-400 text-center py-8">
                      Your position details will appear here
                    </div>
                  ) : (
                    <div className="text-slate-400 text-center py-8">
                      Connect wallet to view your position
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4">Current Prices</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400">YES</span>
                  <span className="text-2xl font-bold text-green-400">{yesPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-600 to-green-400 h-3 rounded-full"
                    style={{ width: `${yesPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400">NO</span>
                  <span className="text-2xl font-bold text-red-400">{noPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-red-600 to-red-400 h-3 rounded-full"
                    style={{ width: `${noPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {!market.resolved && (
            <TradingInterface market={market} />
          )}

          {market.resolved && market.outcome !== undefined && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Final Outcome</h2>
              <div className={`text-center py-6 rounded-lg font-bold text-xl ${
                market.outcome
                  ? 'bg-green-600/20 text-green-400'
                  : 'bg-red-600/20 text-red-400'
              }`}>
                {market.outcome ? 'YES' : 'NO'}
              </div>
              <ClaimButton sessionId={market.sessionId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

