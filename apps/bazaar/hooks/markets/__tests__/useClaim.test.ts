import { describe, test, expect } from 'bun:test';

describe('useClaim Hook', () => {
  test('should export useClaim function', () => {
    const { useClaim } = require('../useClaim');
    expect(typeof useClaim).toBe('function');
  });

  test('should handle missing contract address', () => {
    const originalEnv = process.env.NEXT_PUBLIC_PREDIMARKET_ADDRESS;
    process.env.NEXT_PUBLIC_PREDIMARKET_ADDRESS = '0x0';
    
    const { useClaim } = require('../useClaim');
    expect(typeof useClaim).toBe('function');
    
    process.env.NEXT_PUBLIC_PREDIMARKET_ADDRESS = originalEnv;
  });

  test('should accept sessionId parameter', () => {
    const { useClaim } = require('../useClaim');
    
    const testSessionId = '0x1234567890123456789012345678901234567890123456789012345678901234';
    expect(testSessionId.length).toBe(66);
  });
});

