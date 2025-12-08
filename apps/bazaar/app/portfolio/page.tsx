'use client';

import { useAccount } from 'wagmi';
import { useUserPositions } from '@/hooks/markets/useUserPositions';
import { useClaim } from '@/hooks/markets/useClaim';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Link from 'next/link';

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { positions, totalValue, totalPnL, loading } = useUserPositions(address);

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Your Portfolio</h1>

      {!isConnected ? (
        <div className="text-center py-20" data-testid="connect-wallet-message">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400">View your market positions and claim winnings</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="text-sm text-slate-400 mb-1">Total Value</div>
              <div className="text-3xl font-bold text-white">
                {(Number(totalValue) / 1e18).toLocaleString()} ETH
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="text-sm text-slate-400 mb-1">Total P&L</div>
              <div className={`text-3xl font-bold ${totalPnL >= 0n ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnL >= 0n ? '+' : ''}{(Number(totalPnL) / 1e18).toLocaleString()} ETH
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="text-sm text-slate-400 mb-1">Active Positions</div>
              <div className="text-3xl font-bold text-white">
                {positions.filter(p => !p.market.resolved).length}
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden" data-testid="positions-table">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Positions</h2>
            </div>
            
            {positions.length === 0 ? (
              <div className="p-12 text-center text-slate-400" data-testid="no-positions">
                No positions yet. <Link href="/markets" className="text-purple-400 hover:underline">Browse markets</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Market
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        P&L
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {positions.map((pos) => {
                      const pnl = Number(pos.totalReceived) - Number(pos.totalSpent);
                      const currentValue = pos.market.resolved
                        ? (pos.market.outcome ? Number(pos.yesShares) : Number(pos.noShares))
                        : Number(pos.yesShares) + Number(pos.noShares);
                      
                      const PositionClaimButton = () => {
                        const { claim, isPending } = useClaim(pos.market.sessionId);
                        return (
                          <button 
                            onClick={claim}
                            disabled={isPending}
                            className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-lg transition"
                          >
                            {isPending ? 'Claiming...' : 'Claim'}
                          </button>
                        );
                      };
                      
                      return (
                        <tr key={pos.id} className="hover:bg-white/5">
                          <td className="px-6 py-4">
                            <Link href={`/markets/${pos.market.sessionId}`} className="text-white hover:text-purple-400">
                              {pos.market.question}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {Number(pos.yesShares) > 0 && (
                                <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                                  YES {(Number(pos.yesShares) / 1e18).toFixed(2)}
                                </span>
                              )}
                              {Number(pos.noShares) > 0 && (
                                <span className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs">
                                  NO {(Number(pos.noShares) / 1e18).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-white">
                            {(currentValue / 1e18).toLocaleString()} ETH
                          </td>
                          <td className="px-6 py-4">
                            <span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {pnl >= 0 ? '+' : ''}{(pnl / 1e18).toFixed(2)} ETH
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {pos.market.resolved ? (
                              pos.hasClaimed ? (
                                <span className="text-slate-400">Claimed</span>
                              ) : (
                                <span className="text-green-400">Ready to claim</span>
                              )
                            ) : (
                              <span className="text-blue-400">Active</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {pos.market.resolved && !pos.hasClaimed && <PositionClaimButton />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

