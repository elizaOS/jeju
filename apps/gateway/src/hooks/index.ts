/**
 * @fileoverview Gateway React hooks for contract interactions
 * @module gateway/hooks
 * 
 * React hooks for interacting with Gateway smart contracts including:
 * - Token registry and multi-token management
 * - Paymaster factory and deployment
 * - Liquidity vault operations
 * - Node staking and unstaking
 * - Token balance queries
 * - Governance proposals and voting
 * 
 * @example Use token registry hook
 * ```typescript
 * import { useTokenRegistry } from '@gateway/hooks';
 * 
 * function TokenList() {
 *   const { tokens, loading } = useTokenRegistry();
 *   return <div>{tokens.map(t => <TokenCard key={t.address} token={t} />)}</div>;
 * }
 * ```
 */

// Token Registry
export * from './useTokenRegistry';
export * from './useProtocolTokens';
export * from './useTokenBalances';

// Paymaster Factory
export * from './usePaymasterFactory';

// Liquidity Vault
export * from './useLiquidityVault';

// Node Staking
export * from './useNodeStaking';

// Agent Registry
export * from './useRegistry';

// Governance
export * from './useGovernance';

// EIL (Ethereum Interop Layer)
export * from './useEIL';

