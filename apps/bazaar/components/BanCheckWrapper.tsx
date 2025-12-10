'use client';

import { useAccount } from 'wagmi';
import { Address } from 'viem';
import { useState, useEffect, useCallback } from 'react';
import { checkUserBan, BanType, BanCheckResult } from '../lib/banCheck';

/**
 * Ban status for the current user
 */
interface BanStatus {
  isBanned: boolean;
  banType: BanType;
  isOnNotice: boolean;
  reason: string;
  caseId: string | null;
  canAppeal: boolean;
  loading: boolean;
}

/**
 * Hook to check user's ban status
 */
function useBanStatus(): BanStatus {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<BanStatus>({
    isBanned: false,
    banType: BanType.NONE,
    isOnNotice: false,
    reason: '',
    caseId: null,
    canAppeal: false,
    loading: true,
  });

  const checkStatus = useCallback(async () => {
    if (!isConnected || !address) {
      setStatus(prev => ({ ...prev, loading: false, isBanned: false }));
      return;
    }

    const result = await checkUserBan(address as Address);
    
    setStatus({
      isBanned: !result.allowed,
      banType: result.banType ?? BanType.NONE,
      isOnNotice: result.onNotice ?? false,
      reason: result.reason ?? '',
      caseId: result.caseId ?? null,
      canAppeal: result.canAppeal ?? false,
      loading: false,
    });
  }, [address, isConnected]);

  useEffect(() => {
    checkStatus();
    // Re-check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return status;
}

/**
 * Ban banner component
 */
function BanBanner({ status }: { status: BanStatus }) {
  if (!status.isBanned && !status.isOnNotice) {
    return null;
  }

  const isOnNotice = status.isOnNotice || status.banType === BanType.ON_NOTICE;
  const isChallenged = status.banType === BanType.CHALLENGED;

  return (
    <div className={`border-l-4 p-4 mb-4 rounded-r-lg ${
      isOnNotice 
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 text-yellow-900 dark:text-yellow-100'
        : isChallenged
        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 text-orange-900 dark:text-orange-100'
        : 'bg-red-50 dark:bg-red-900/20 border-red-400 text-red-900 dark:text-red-100'
    }`}>
      <div className="flex items-start gap-3">
        {/* Warning Icon */}
        <div className={`flex-shrink-0 ${
          isOnNotice ? 'text-yellow-500' : isChallenged ? 'text-orange-500' : 'text-red-500'
        }`}>
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-lg">
            {isOnNotice 
              ? '⚠️ Account Under Review' 
              : isChallenged 
              ? '⏳ Ban Challenged - Vote in Progress'
              : '🚫 Account Banned'}
          </h3>
          
          <p className="mt-1 text-sm opacity-90">
            {isOnNotice 
              ? 'Your trading access is restricted while your account is under review. You can still view markets but cannot trade.'
              : isChallenged
              ? 'A moderation case is active. The community is voting on your account status.'
              : 'You have been banned from Bazaar. Trading and other actions are disabled.'}
          </p>

          {status.reason && (
            <div className="mt-2 p-2 bg-black/5 dark:bg-white/5 rounded text-sm">
              <strong>Reason:</strong> {status.reason}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {/* Status Badge */}
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              isOnNotice ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200' :
              isChallenged ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200' :
              'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
            }`}>
              {isOnNotice ? 'On Notice' : isChallenged ? 'Challenged' : 'Banned'}
            </span>

            {status.caseId && (
              <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">
                Case: {status.caseId.slice(0, 10)}...
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            {status.canAppeal && (
              <a
                href="/moderation"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status.banType === BanType.PERMANENT
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                Appeal Ban
              </a>
            )}
            
            <a
              href="/moderation"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              View Moderation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper component that checks ban status and shows banner
 */
export function BanCheckWrapper({ children }: { children: React.ReactNode }) {
  const banStatus = useBanStatus();

  return (
    <>
      <BanBanner status={banStatus} />
      {children}
    </>
  );
}

/**
 * Hook to check if user can perform actions (not banned)
 */
export function useCanPerformAction(): { canAct: boolean; reason: string | null } {
  const banStatus = useBanStatus();
  
  if (banStatus.loading) {
    return { canAct: true, reason: null };
  }
  
  if (banStatus.isBanned && banStatus.banType === BanType.PERMANENT) {
    return { canAct: false, reason: banStatus.reason || 'Account banned' };
  }
  
  return { canAct: true, reason: null };
}
