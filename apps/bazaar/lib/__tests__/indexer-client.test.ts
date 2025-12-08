import { describe, test, expect, beforeAll } from 'bun:test';
import { getJejuTokens, getTokenTransfers, getTokenHolders } from '../indexer-client';

const SKIP_INDEXER_TESTS = process.env.SKIP_INDEXER_TESTS === 'true';

describe('Indexer Client', () => {
  beforeAll(() => {
    if (SKIP_INDEXER_TESTS) {
      console.log('   ⚠️ Skipping indexer tests (SKIP_INDEXER_TESTS=true)');
    }
  });

  test('should fetch Jeju tokens', async () => {
    if (SKIP_INDEXER_TESTS) return;
    const tokens = await getJejuTokens({ limit: 10 });
    expect(tokens).toBeDefined();
    expect(Array.isArray(tokens)).toBe(true);
  });

  test('should filter tokens with limit', async () => {
    if (SKIP_INDEXER_TESTS) return;
    const tokens = await getJejuTokens({ limit: 5 });
    expect(Array.isArray(tokens)).toBe(true);
    if (tokens.length > 0) {
      expect(tokens.length).toBeLessThanOrEqual(5);
    }
  });

  test('should fetch token transfers', async () => {
    if (SKIP_INDEXER_TESTS) return;
    const mockAddress = '0x0000000000000000000000000000000000000001';
    const transfers = await getTokenTransfers(mockAddress, 10);
    expect(transfers).toBeDefined();
    expect(Array.isArray(transfers)).toBe(true);
  });

  test('should fetch token holders', async () => {
    if (SKIP_INDEXER_TESTS) return;
    const mockAddress = '0x0000000000000000000000000000000000000001';
    const holders = await getTokenHolders(mockAddress, 10);
    expect(holders).toBeDefined();
    expect(Array.isArray(holders)).toBe(true);
  });

  test('should throw on invalid address format', async () => {
    if (SKIP_INDEXER_TESTS) return;
    await expect(getTokenTransfers('invalid-address', 10)).rejects.toThrow();
  });
  
  test('indexer client module should be importable', () => {
    expect(typeof getJejuTokens).toBe('function');
    expect(typeof getTokenTransfers).toBe('function');
    expect(typeof getTokenHolders).toBe('function');
  });
});

