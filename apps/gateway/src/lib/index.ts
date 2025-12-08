/**
 * @fileoverview Gateway core library exports
 * @module gateway/lib
 * 
 * Core utilities for the Gateway multi-token liquidity and governance portal.
 * Includes contract ABIs, token utilities, IPFS integration, node staking,
 * and x402 micropayment support.
 * 
 * @example Import gateway libraries
 * ```typescript
 * import { TOKEN_REGISTRY_ABI, getTokenList } from '@gateway/lib';
 * import { uploadToIPFS } from '@gateway/lib';
 * ```
 */

// Contract ABIs and addresses
export * from './contracts';

// Token utilities
export * from './tokens';
export * from './tokenUtils';

// IPFS integration
export * from './ipfs';

// Node staking
export * from './nodeStaking';

// x402 Payment Protocol
export * from './x402';

