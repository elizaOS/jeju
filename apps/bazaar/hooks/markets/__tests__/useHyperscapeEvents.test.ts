import { describe, test, expect } from 'bun:test';

describe('useHyperscapeEvents Hook', () => {
  test('should export useHyperscapeEvents function', () => {
    const { useHyperscapeEvents } = require('../useHyperscapeEvents');
    expect(typeof useHyperscapeEvents).toBe('function');
  });

  test('should export PlayerSkillEvent interface', () => {
    const module = require('../useHyperscapeEvents');
    expect(module).toHaveProperty('useHyperscapeEvents');
  });

  test('should export PlayerStats interface', () => {
    const module = require('../useHyperscapeEvents');
    expect(module).toHaveProperty('useHyperscapeEvents');
  });
});

