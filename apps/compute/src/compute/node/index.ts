/**
 * Jeju Compute Node
 *
 * A local inference server that's OpenAI-compatible and integrates
 * with the Jeju compute marketplace.
 *
 * Default port: 4007 (COMPUTE_PORT env var)
 */

export * from './attestation';
export * from './hardware';
export * from './inference';
export * from './server';
export * from './types';

// Run as standalone server
if (import.meta.main) {
  const { startComputeNode } = await import('./server');
  await startComputeNode();
}
