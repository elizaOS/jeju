/**
 * Commit-Reveal Protocol Tests
 *
 * Tests the commit-reveal scheme that prevents front-running.
 */

import { describe, expect, it } from 'bun:test';
import {
  CommitRevealManager,
  computeDataHash,
  verifyDataHash,
} from '../protocol/commit-reveal.js';
import type { Storage } from '../storage/storage-interface.js';

// Mock storage for testing
function createMockStorage(): Storage {
  const stored = new Map<string, Uint8Array>();
  let uploadCount = 0;

  return {
    upload: async (data: string | Uint8Array) => {
      const id = `mock-${++uploadCount}`;
      const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data;
      stored.set(id, bytes);
      return { id, url: `https://mock/${id}`, size: bytes.length, cost: '0' };
    },
    uploadJSON: async (data: unknown) => {
      const id = `mock-${++uploadCount}`;
      const bytes = new TextEncoder().encode(JSON.stringify(data));
      stored.set(id, bytes);
      return { id, url: `https://mock/${id}`, size: bytes.length, cost: '0' };
    },
    download: async (id: string) => {
      const data = stored.get(id);
      if (!data) throw new Error(`Not found: ${id}`);
      return data;
    },
    downloadJSON: async <T>(id: string): Promise<T> => {
      const data = stored.get(id);
      if (!data) throw new Error(`Not found: ${id}`);
      return JSON.parse(new TextDecoder().decode(data));
    },
    exists: async (id: string) => stored.has(id),
    getUrl: (id: string) => `https://mock/${id}`,
    getStats: () => ({
      objectCount: stored.size,
      totalSize: Array.from(stored.values()).reduce(
        (sum, d) => sum + d.length,
        0
      ),
      encryptedCount: 0,
      publicCount: stored.size,
    }),
  };
}

describe('CommitRevealManager', () => {
  describe('commit', () => {
    it('creates commitment with data hash', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 100 });

      const data = new TextEncoder().encode('secret data');
      const commitment = await manager.commit(data, 'game-state');

      expect(commitment.id).toMatch(/^commit-/);
      expect(commitment.dataHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(commitment.storageId).toBeDefined();
      expect(commitment.revealAfter).toBeGreaterThan(
        commitment.commitTimestamp
      );
    });

    it('increments nonce for each commitment', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 100 });

      const data = new TextEncoder().encode('data');
      const c1 = await manager.commit(data, 'game-state');
      const c2 = await manager.commit(data, 'game-state');

      expect(c1.nonce).toBe(1);
      expect(c2.nonce).toBe(2);
    });
  });

  describe('reveal', () => {
    it('reveals data after delay', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 10 });

      const data = new TextEncoder().encode('secret');
      const commitment = await manager.commit(data, 'game-state');

      // Wait for reveal window
      await new Promise((r) => setTimeout(r, 15));

      const reveal = await manager.reveal(commitment.id, data);

      expect(reveal.commitmentId).toBe(commitment.id);
      expect(reveal.dataHash).toBe(commitment.dataHash);
      expect(reveal.storageId).toBeDefined();
    });

    it('rejects reveal before delay', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 1000 });

      const data = new TextEncoder().encode('secret');
      const commitment = await manager.commit(data, 'game-state');

      await expect(manager.reveal(commitment.id, data)).rejects.toThrow(
        'Cannot reveal yet'
      );
    });

    it('rejects reveal with wrong data', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 10 });

      const data = new TextEncoder().encode('original');
      const commitment = await manager.commit(data, 'game-state');

      await new Promise((r) => setTimeout(r, 15));

      const wrongData = new TextEncoder().encode('tampered');
      await expect(manager.reveal(commitment.id, wrongData)).rejects.toThrow(
        'mismatch'
      );
    });

    it('rejects unknown commitment', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 10 });

      const data = new TextEncoder().encode('data');
      await expect(manager.reveal('unknown-id', data)).rejects.toThrow(
        'Unknown commitment'
      );
    });
  });

  describe('verification', () => {
    it('verifies matching reveal', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 10 });

      const data = new TextEncoder().encode('secret');
      const commitment = await manager.commit(data, 'game-state');

      const result = await manager.verifyReveal(commitment.id, data);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects mismatched reveal', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 10 });

      const data = new TextEncoder().encode('secret');
      const commitment = await manager.commit(data, 'game-state');

      const wrongData = new TextEncoder().encode('wrong');
      const result = await manager.verifyReveal(commitment.id, wrongData);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('mismatch');
    });
  });

  describe('state', () => {
    it('tracks pending commitments', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 10 });

      const data = new TextEncoder().encode('data');
      await manager.commit(data, 'game-state');
      await manager.commit(data, 'training-data');

      const pending = manager.getPendingCommitments();

      expect(pending).toHaveLength(2);
    });

    it('canReveal returns correct state', async () => {
      const storage = createMockStorage();
      const manager = new CommitRevealManager(storage, { revealDelay: 50 });

      const data = new TextEncoder().encode('data');
      const commitment = await manager.commit(data, 'game-state');

      expect(manager.canReveal(commitment.id)).toBe(false);

      await new Promise((r) => setTimeout(r, 60));

      expect(manager.canReveal(commitment.id)).toBe(true);
    });
  });
});

describe('Utility Functions', () => {
  it('computeDataHash produces consistent hash', () => {
    const data = new TextEncoder().encode('test data');

    const hash1 = computeDataHash(data);
    const hash2 = computeDataHash(data);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('verifyDataHash validates correctly', () => {
    const data = new TextEncoder().encode('test');
    const hash = computeDataHash(data);

    expect(verifyDataHash(data, hash)).toBe(true);
    expect(verifyDataHash(new TextEncoder().encode('wrong'), hash)).toBe(false);
  });
});
