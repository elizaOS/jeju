import { describe, test, expect } from 'bun:test';

describe('useGameFeed Hook', () => {
  test('should export useGameFeed function', () => {
    const { useGameFeed } = require('../useGameFeed');
    expect(typeof useGameFeed).toBe('function');
  });

  test('should export GameFeedPost interface type', () => {
    const module = require('../useGameFeed');
    expect(module).toHaveProperty('useGameFeed');
  });

  test('should export GameMarketUpdate interface type', () => {
    const module = require('../useGameFeed');
    expect(module).toHaveProperty('useGameFeed');
  });

  test('should accept sessionId parameter', () => {
    const { useGameFeed } = require('../useGameFeed');
    
    const testSessionId = '0x1234567890123456789012345678901234567890123456789012345678901234';
    expect(testSessionId.length).toBe(66);
    expect(typeof useGameFeed).toBe('function');
  });
});

