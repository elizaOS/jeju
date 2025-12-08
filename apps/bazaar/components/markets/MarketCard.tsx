'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { Market } from '@/types/markets';

export function MarketCard({ market }: { market: Market }) {
  const yesPercent = Number(market.yesPrice) / 1e16;
  const noPercent = Number(market.noPrice) / 1e16;
  
  return (
    <Link href={`/markets/${market.sessionId}`} data-testid="market-card">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-purple-600 transition cursor-pointer group">
        <div className="flex items-center justify-between mb-4">
          {market.resolved ? (
            <span className="px-3 py-1 bg-white/10 text-slate-400 rounded-full text-xs font-medium">
              Resolved
            </span>
          ) : (
            <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-xs font-medium">
              Active
            </span>
          )}
          <span className="text-xs text-slate-500">
            {formatDistanceToNow(market.createdAt, { addSuffix: true })}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-white mb-4 group-hover:text-purple-400 transition line-clamp-2">
          {market.question}
        </h3>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-slate-400">YES</span>
              <span className="text-sm font-bold text-green-400">{yesPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-600 to-green-400 h-2 rounded-full transition-all"
                style={{ width: `${yesPercent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-slate-400">NO</span>
              <span className="text-sm font-bold text-red-400">{noPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-red-600 to-red-400 h-2 rounded-full transition-all"
                style={{ width: `${noPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Volume</span>
            <span className="text-white font-medium">
              {(Number(market.totalVolume) / 1e18).toLocaleString()} ETH
            </span>
          </div>
        </div>

        {market.resolved && market.outcome !== undefined && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className={`text-center py-2 rounded-lg font-bold ${
              market.outcome
                ? 'bg-green-600/20 text-green-400'
                : 'bg-red-600/20 text-red-400'
            }`}>
              Outcome: {market.outcome ? 'YES' : 'NO'}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}



