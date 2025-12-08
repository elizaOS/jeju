/**
 * AI Agent Tests
 *
 * Tests the neural network agent: initialization, prediction,
 * training, and state persistence.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { AIAgent, type TrainingSample } from '../game/agent.js';

describe('AIAgent', () => {
  const defaultConfig = {
    inputSize: 5,
    hiddenSize: 8,
    outputSize: 1,
    learningRate: 0.1,
  };

  describe('initialization', () => {
    it('initializes with correct dimensions', () => {
      const agent = new AIAgent(defaultConfig);
      const stats = agent.getStats();

      expect(stats.epoch).toBe(0);
      expect(stats.totalSamples).toBe(0);
      expect(stats.averageLoss).toBe(1.0);
    });

    it('serializes to correct structure', () => {
      const agent = new AIAgent({
        inputSize: 3,
        hiddenSize: 4,
        outputSize: 1,
        learningRate: 0.1,
      });

      const state = agent.serialize();

      expect(state.inputWeights.length).toBe(3);
      expect(state.hiddenWeights.length).toBe(4);
      expect(state.bias1.length).toBe(4);
      expect(state.bias2.length).toBe(1);
    });

    it('generates consistent model hash', () => {
      const agent = new AIAgent(defaultConfig);

      const hash1 = agent.getModelHash();
      const hash2 = agent.getModelHash();

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });

  describe('prediction', () => {
    let agent: AIAgent;

    beforeEach(() => {
      agent = new AIAgent(defaultConfig);
    });

    it('produces output in valid range (0-1)', () => {
      const result = agent.predict([0.1, 0.2, 0.3, 0.4, 0.5]);

      expect(result.prediction.length).toBe(1);
      expect(result.prediction[0]).toBeGreaterThanOrEqual(0);
      expect(result.prediction[0]).toBeLessThanOrEqual(1);
    });

    it('produces confidence between 0 and 1', () => {
      const result = agent.predict([0.5, 0.5, 0.5, 0.5, 0.5]);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('handles zero input', () => {
      const result = agent.predict([0, 0, 0, 0, 0]);
      expect(Number.isFinite(result.prediction[0])).toBe(true);
    });

    it('produces consistent predictions', () => {
      const input = [0.1, 0.2, 0.3, 0.4, 0.5];

      const result1 = agent.predict(input);
      const result2 = agent.predict(input);

      expect(result1.prediction[0]).toBe(result2.prediction[0]);
    });
  });

  describe('training', () => {
    let agent: AIAgent;

    beforeEach(() => {
      agent = new AIAgent(defaultConfig);
    });

    it('reduces loss on consistent data', () => {
      const samples: TrainingSample[] = [];
      for (let i = 0; i < 50; i++) {
        samples.push({
          input: [0.2, 0.4, 0.6, 0.8, 1.0],
          target: [0.6],
          timestamp: Date.now(),
        });
      }

      const initialLoss = agent.getStats().averageLoss;

      for (let epoch = 0; epoch < 10; epoch++) {
        agent.train(samples);
      }

      expect(agent.getStats().averageLoss).toBeLessThan(initialLoss);
    });

    it('increments epoch counter', () => {
      const samples: TrainingSample[] = [
        {
          input: [0.1, 0.2, 0.3, 0.4, 0.5],
          target: [0.3],
          timestamp: Date.now(),
        },
      ];

      expect(agent.getStats().epoch).toBe(0);
      agent.train(samples);
      expect(agent.getStats().epoch).toBe(1);
      agent.train(samples);
      expect(agent.getStats().epoch).toBe(2);
    });

    it('tracks total samples', () => {
      const samples1 = Array.from({ length: 10 }, () => ({
        input: [0.1, 0.2, 0.3, 0.4, 0.5],
        target: [0.3],
        timestamp: Date.now(),
      }));
      const samples2 = Array.from({ length: 20 }, () => ({
        input: [0.1, 0.2, 0.3, 0.4, 0.5],
        target: [0.3],
        timestamp: Date.now(),
      }));

      agent.train(samples1);
      expect(agent.getStats().totalSamples).toBe(10);

      agent.train(samples2);
      expect(agent.getStats().totalSamples).toBe(30);
    });

    it('changes model hash after training', () => {
      const hashBefore = agent.getModelHash();

      agent.train([
        {
          input: [0.1, 0.2, 0.3, 0.4, 0.5],
          target: [0.9],
          timestamp: Date.now(),
        },
      ]);

      expect(agent.getModelHash()).not.toBe(hashBefore);
    });

    it('reports whether loss improved', () => {
      const samples = Array.from({ length: 50 }, () => ({
        input: [0.5, 0.5, 0.5, 0.5, 0.5],
        target: [0.5],
        timestamp: Date.now(),
      }));

      const result = agent.train(samples);
      expect(result.improved).toBe(true);
    });
  });

  describe('state persistence', () => {
    it('restores from saved state', () => {
      const agent1 = new AIAgent(defaultConfig);

      const samples = Array.from({ length: 20 }, () => ({
        input: [0.3, 0.4, 0.5, 0.6, 0.7],
        target: [0.5],
        timestamp: Date.now(),
      }));
      agent1.train(samples);
      agent1.train(samples);

      const savedState = agent1.serialize();
      const savedHash = agent1.getModelHash();

      const agent2 = new AIAgent(defaultConfig);
      agent2.loadState(savedState);

      expect(agent2.getModelHash()).toBe(savedHash);
      expect(agent2.getStats().epoch).toBe(savedState.epoch);
    });

    it('produces same predictions after loading state', () => {
      const agent1 = new AIAgent(defaultConfig);

      agent1.train([
        {
          input: [0.3, 0.4, 0.5, 0.6, 0.7],
          target: [0.5],
          timestamp: Date.now(),
        },
      ]);

      const input = [0.1, 0.2, 0.3, 0.4, 0.5];
      const prediction1 = agent1.predict(input);

      const agent2 = new AIAgent(defaultConfig);
      agent2.loadState(agent1.serialize());
      const prediction2 = agent2.predict(input);

      expect(prediction1.prediction[0]).toBe(prediction2.prediction[0]);
    });
  });
});
