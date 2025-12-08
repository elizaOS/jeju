/**
 * @fileoverview IPFS Pinning API server
 * @module ipfs/pinning-api
 * 
 * Provides a Pinata-compatible IPFS pinning service with PostgreSQL backend.
 * Supports file uploads, pinning, unpinning, and metadata management with
 * x402 micropayment integration.
 * 
 * Features:
 * - Pinata-compatible API endpoints
 * - PostgreSQL storage backend
 * - File metadata tracking
 * - x402 payment verification
 * - ERC-8004 agent integration
 * - A2A protocol support
 * 
 * @example Pin a file
 * ```bash
 * curl -X POST http://localhost:5001/api/v0/add \
 *   -F file=@myfile.txt \
 *   -H "Authorization: Bearer YOUR_TOKEN"
 * ```
 * 
 * @example Query via A2A
 * ```typescript
 * const response = await fetch('http://localhost:5001/api/a2a', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     jsonrpc: '2.0',
 *     method: 'message/send',
 *     params: {
 *       message: {
 *         parts: [{ kind: 'data', data: { skillId: 'pin-file', cid: 'Qm...' } }]
 *       }
 *     },
 *     id: 1
 *   })
 * });
 * ```
 */

// Main server exports would go here
// Currently this is a server-only module, so we'll export the key types and utilities

export * from './lib/paymaster';
export * from './lib/erc8004';
export * from './middleware/x402';
