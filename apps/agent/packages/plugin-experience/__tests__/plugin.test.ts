import { describe, it, expect } from 'vitest';
import { experiencePlugin } from '../src/index';

describe('Experience Plugin Tests', () => {
  describe('Plugin Structure Tests', () => {
    it('should have correct plugin metadata', () => {
      expect(experiencePlugin.name).toBe('experience');
      expect(experiencePlugin.description).toBe(
        'Self-learning experience system that records experiences and learns from agent interactions'
      );
    });

    it('should export required components', () => {
      expect(experiencePlugin.services).toBeDefined();
      expect(experiencePlugin.services?.length).toBeGreaterThan(0);
      expect(experiencePlugin.providers).toBeDefined();
      expect(experiencePlugin.evaluators).toBeDefined();
    });
  });
});
