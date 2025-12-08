'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import type { Market } from '@/types/markets';
import { checkUserBan } from '@/lib/erc8004';
import { calculateExpectedShares } from '@/lib/markets/lmsrPricing';
import { toast } from 'sonner';

const PREDIMARKET_ADDRESS = (process.env.NEXT_PUBLIC_PREDIMARKET_ADDRESS || '0x0') as `0x${string}`;
const ELIZAOS_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_ELIZA_OS_ADDRESS || '0x0') as `0x${string}`;

const BUY_ABI = [{
  name: 'buy',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'sessionId', type: 'bytes32' },
    { name: 'outcome', type: 'bool' },
    { name: 'tokenAmount', type: 'uint256' },
    { name: 'minShares', type: 'uint256' },
    { name: 'token', type: 'address' }
  ],
  outputs: [{ name: 'shares', type: 'uint256' }]
}] as const;

export function TradingInterface({ market }: { market: Market }) {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });
  
  const [outcome, setOutcome] = useState<boolean>(true);
  const [amount, setAmount] = useState<string>('100');
  const [banReason, setBanReason] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      checkUserBan(address, 'markets').then(result => {
        if (!result.allowed) setBanReason(result.reason || 'Banned');
      });
    }
  }, [address]);

  const handleBuy = () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (banReason) {
      toast.error('Trading not allowed', { description: banReason });
      return;
    }

    const amountWei = parseEther(amount);
    const currentPrice = outcome ? market.yesPrice : market.noPrice;
    const expectedShares = calculateExpectedShares(amountWei, currentPrice);
    const minShares = (expectedShares * 95n) / 100n;
    
    writeContract({
      address: PREDIMARKET_ADDRESS,
      abi: BUY_ABI,
      functionName: 'buy',
      args: [market.sessionId as `0x${string}`, outcome, amountWei, minShares, ELIZAOS_TOKEN_ADDRESS],
    });
  };

  const yesPercent = Number(market.yesPrice) / 1e16;
  const noPercent = Number(market.noPrice) / 1e16;

  if (banReason) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-xl p-6" data-testid="trading-banned">
        <h2 className="text-lg font-bold text-red-400 mb-2">Trading Restricted</h2>
        <p className="text-sm text-red-300">{banReason}</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6" data-testid="trading-interface">
      <h2 className="text-lg font-bold text-white mb-4">Place Bet</h2>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setOutcome(true)}
          className={`px-4 py-3 rounded-lg font-medium transition ${
            outcome ? 'bg-green-600 text-white ring-2 ring-green-400' : 'bg-white/10 text-slate-400'
          }`}
          data-testid="outcome-yes-button"
        >
          YES {yesPercent.toFixed(1)}%
        </button>
        <button
          onClick={() => setOutcome(false)}
          className={`px-4 py-3 rounded-lg font-medium transition ${
            !outcome ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-white/10 text-slate-400'
          }`}
          data-testid="outcome-no-button"
        >
          NO {noPercent.toFixed(1)}%
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-400 mb-2">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
          placeholder="100"
          data-testid="amount-input"
        />
      </div>

      <button
        onClick={handleBuy}
        disabled={!isConnected || isPending || isConfirming}
        className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg transition"
        data-testid="buy-button"
      >
        {isPending || isConfirming ? 'Confirming...' : `Buy ${outcome ? 'YES' : 'NO'}`}
      </button>
    </div>
  );
}

