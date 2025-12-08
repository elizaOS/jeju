/**
 * @fileoverview React hooks for token registry contract interactions
 * @module gateway/hooks/useTokenRegistry
 * 
 * Provides hooks for interacting with the multi-token registry system,
 * including token registration, configuration queries, and fee management.
 * 
 * @example Register a new token
 * ```typescript
 * import { useTokenRegistry } from '@/hooks/useTokenRegistry';
 * 
 * function RegisterToken() {
 *   const { registerToken, isPending, isSuccess } = useTokenRegistry();
 *   
 *   const handleRegister = () => {
 *     registerToken(
 *       '0x...', // token address
 *       '0x...', // oracle address  
 *       500,     // min fee (5%)
 *       1000     // max fee (10%)
 *     );
 *   };
 *   
 *   return <button onClick={handleRegister} disabled={isPending}>Register</button>;
 * }
 * ```
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { TOKEN_REGISTRY_ABI, getContractAddresses } from '../lib/contracts';

/**
 * Hook for interacting with the token registry contract
 * 
 * Provides functions to register new tokens, query registered tokens,
 * and read configuration settings like registration fees.
 * 
 * @returns Object containing token registry data and functions
 * @returns {string[]} allTokens - Array of registered token addresses
 * @returns {bigint | undefined} registrationFee - Fee required to register a token
 * @returns {(tokenAddress, oracleAddress, minFee, maxFee) => void} registerToken - Function to register a new token
 * @returns {boolean} isPending - True while registration transaction is pending
 * @returns {boolean} isSuccess - True when registration is confirmed
 * @returns {() => void} refetchTokens - Function to refresh the token list
 * 
 * @example
 * ```typescript
 * const { allTokens, registerToken, isPending } = useTokenRegistry();
 * ```
 */
export function useTokenRegistry() {
  const { tokenRegistry } = getContractAddresses();

  // Read all tokens
  const { data: allTokens, refetch: refetchTokens } = useReadContract({
    address: tokenRegistry,
    abi: TOKEN_REGISTRY_ABI,
    functionName: 'getAllTokens',
  });

  // Read registration fee
  const { data: registrationFee } = useReadContract({
    address: tokenRegistry,
    abi: TOKEN_REGISTRY_ABI,
    functionName: 'registrationFee',
  });

  // Write: Register token
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const registerToken = async (
    tokenAddress: `0x${string}`,
    oracleAddress: `0x${string}`,
    minFee: number,
    maxFee: number
  ) => {
    writeContract({
      address: tokenRegistry,
      abi: TOKEN_REGISTRY_ABI,
      functionName: 'registerToken',
      args: [tokenAddress, oracleAddress, BigInt(minFee), BigInt(maxFee)],
      value: registrationFee || parseEther('0.1'),
    });
  };

  return {
    allTokens: (allTokens as `0x${string}`[]) || [],
    registrationFee,
    registerToken,
    isPending: isPending || isConfirming,
    isSuccess,
    refetchTokens,
  };
}

/**
 * Hook for fetching token configuration from the registry
 * 
 * Retrieves detailed configuration for a specific token including
 * oracle settings, fee margins, and deployment status.
 * 
 * @param tokenAddress - Token contract address to query
 * @returns Object containing token configuration and refetch function
 * @returns {object | undefined} config - Token configuration object
 * @returns {() => void} refetch - Function to refresh the configuration
 * 
 * @example
 * ```typescript
 * const { config, refetch } = useTokenConfig('0x123...');
 * console.log('Min fee:', config?.minFeeMargin);
 * ```
 */
export function useTokenConfig(tokenAddress: `0x${string}` | undefined) {
  const { tokenRegistry } = getContractAddresses();

  const { data: config, refetch } = useReadContract({
    address: tokenRegistry,
    abi: TOKEN_REGISTRY_ABI,
    functionName: 'getTokenConfig',
    args: tokenAddress ? [tokenAddress] : undefined,
  });

  return {
    config,
    refetch,
  };
}

