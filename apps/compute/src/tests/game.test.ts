/**
 * Game Environment and Trainer Tests
 *
 * Tests the game mechanics:
 * - Session management and pattern generation
 * - Scoring and statistics
 * - Training data generation
 * - AI trainer integration
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { AIAgent } from '../game/agent.js';
import { GameEnvironment } from '../game/environment.js';
import { AITrainer } from '../game/trainer.js';

describe('GameEnvironment', () => {
  let env: GameEnvironment;

  beforeEach(() => {
    env = new GameEnvironment({
      sequenceLength: 5,
      patternTypes: ['linear', 'quadratic', 'fibonacci'],
      difficulty: 5,
    });
  });

  describe('sessions', () => {
    it('starts a new session', () => {
      const session = env.startSession('linear');

      expect(session.id).toBe('session-1');
      expect(session.patternType).toBe('linear');
      expect(session.sequence).toHaveLength(6); // sequenceLength + 1
      expect(session.completed).toBe(false);
    });

    it('increments session IDs', () => {
      const session1 = env.startSession();
      const session2 = env.startSession();
      const session3 = env.startSession();

      expect(session1.id).toBe('session-1');
      expect(session2.id).toBe('session-2');
      expect(session3.id).toBe('session-3');
    });

    it('returns visible sequence without answer', () => {
      env.startSession();
      const visible = env.getVisibleSequence();

      expect(visible).toHaveLength(5);
    });

    it('throws if no active session', () => {
      expect(() => env.getVisibleSequence()).toThrow('No active session');
    });
  });

  describe('patterns', () => {
    it('generates linear patterns (constant difference)', () => {
      const session = env.startSession('linear');
      const seq = session.sequence;

      const diff = seq[1]! - seq[0]!;
      for (let i = 2; i < seq.length; i++) {
        expect(seq[i]! - seq[i - 1]!).toBe(diff);
      }
    });

    it('generates quadratic patterns (constant second difference)', () => {
      const session = env.startSession('quadratic');
      const seq = session.sequence;

      const firstDiffs = [];
      for (let i = 1; i < seq.length; i++) {
        firstDiffs.push(seq[i]! - seq[i - 1]!);
      }

      const secondDiffs = [];
      for (let i = 1; i < firstDiffs.length; i++) {
        secondDiffs.push(firstDiffs[i]! - firstDiffs[i - 1]!);
      }

      const expected = secondDiffs[0];
      expect(secondDiffs.every((d) => d === expected)).toBe(true);
    });

    it('generates fibonacci patterns', () => {
      const session = env.startSession('fibonacci');
      const seq = session.sequence;

      for (let i = 2; i < seq.length; i++) {
        expect(seq[i]).toBe(seq[i - 1]! + seq[i - 2]!);
      }
    });
  });

  describe('scoring', () => {
    beforeEach(() => {
      env = new GameEnvironment({
        sequenceLength: 5,
        patternTypes: ['linear'],
        difficulty: 5,
      });
    });

    it('scores correct guesses', () => {
      env.startSession('linear');
      const session = env.getCurrentSession()!;
      const actual = session.sequence[session.sequence.length - 1]!;

      const result = env.submitGuesses(actual, actual);

      expect(result.playerCorrect).toBe(true);
      expect(result.agentCorrect).toBe(true);
      expect(result.actual).toBe(actual);
    });

    it('accepts guesses within tolerance', () => {
      env.startSession('linear');
      const session = env.getCurrentSession()!;
      const actual = session.sequence[session.sequence.length - 1]!;

      // difficulty=5 means tolerance=5
      const result = env.submitGuesses(actual + 5, actual - 5);

      expect(result.playerCorrect).toBe(true);
      expect(result.agentCorrect).toBe(true);
    });

    it('rejects guesses outside tolerance', () => {
      env.startSession('linear');
      const session = env.getCurrentSession()!;
      const actual = session.sequence[session.sequence.length - 1]!;

      const result = env.submitGuesses(actual + 10, actual - 10);

      expect(result.playerCorrect).toBe(false);
      expect(result.agentCorrect).toBe(false);
    });

    it('marks session as completed', () => {
      env.startSession();
      expect(env.getCurrentSession()!.completed).toBe(false);

      env.submitGuesses(0, 0);
      expect(env.getCurrentSession()!.completed).toBe(true);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      env = new GameEnvironment({
        sequenceLength: 5,
        patternTypes: ['linear'],
        difficulty: 10, // Strict tolerance
      });
    });

    it('tracks session statistics', () => {
      for (let i = 0; i < 5; i++) {
        env.startSession();
        const session = env.getCurrentSession()!;
        const actual = session.sequence[session.sequence.length - 1]!;

        // Player exact, agent off by 5
        env.submitGuesses(actual, actual + 5);
      }

      const stats = env.getStats();
      expect(stats.totalSessions).toBe(5);
      expect(stats.playerWins).toBe(5);
      expect(stats.agentWins).toBe(0);
    });

    it('normalizes agent input to 0-1 range', () => {
      env.startSession();
      const input = env.getAgentInput();

      expect(input.every((v) => v >= 0 && v <= 1)).toBe(true);
      expect(input).toHaveLength(5);
    });
  });

  describe('training data', () => {
    it('generates training sample from completed session', () => {
      env.startSession();
      env.submitGuesses(0, 0);

      const sample = env.generateTrainingSample();

      expect(sample).not.toBeNull();
      expect(sample!.input).toHaveLength(5);
      expect(sample!.target).toHaveLength(1);
      expect(sample!.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('returns null for incomplete session', () => {
      env.startSession();
      expect(env.generateTrainingSample()).toBeNull();
    });

    it('generates training batch', () => {
      const batch = env.generateTrainingBatch(20);

      expect(batch).toHaveLength(20);
      for (const sample of batch) {
        expect(sample.input).toHaveLength(5);
        expect(sample.target).toHaveLength(1);
        expect(sample.input.every((v) => v >= 0 && v <= 1)).toBe(true);
        expect(sample.target[0]).toBeGreaterThanOrEqual(0);
        expect(sample.target[0]).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('AITrainer', () => {
  let trainer: AITrainer;
  let agent: AIAgent;
  let env: GameEnvironment;

  beforeEach(() => {
    agent = new AIAgent({
      inputSize: 5,
      hiddenSize: 8,
      outputSize: 1,
      learningRate: 0.1,
    });

    env = new GameEnvironment({
      sequenceLength: 5,
      patternTypes: ['linear'],
      difficulty: 5,
    });

    trainer = new AITrainer(
      { batchSize: 20, epochsPerCycle: 5, targetLoss: 0.001 },
      agent,
      env
    );
  });

  it('runs training cycle', () => {
    const result = trainer.runTrainingCycle();

    expect(result.cycleNumber).toBe(1);
    expect(result.epochsRun).toBeGreaterThan(0);
    expect(result.samples).toHaveLength(20);
    expect(result.modelHashBefore).toMatch(/^0x[a-f0-9]{64}$/);
    expect(result.modelHashAfter).toMatch(/^0x[a-f0-9]{64}$/);
    expect(result.modelHashBefore).not.toBe(result.modelHashAfter);
  });

  it('increments cycle counter', () => {
    trainer.runTrainingCycle();
    trainer.runTrainingCycle();
    trainer.runTrainingCycle();

    expect(trainer.getStats().totalCycles).toBe(3);
  });

  it('tracks loss improvement', () => {
    const result = trainer.runTrainingCycle();

    expect(result.initialLoss).toBeGreaterThan(result.finalLoss);
    expect(result.improved).toBe(true);
  });

  it('evaluates agent performance', () => {
    trainer.runTrainingCycle();

    const evaluation = trainer.evaluate(10);

    expect(evaluation.samples).toHaveLength(10);
    expect(evaluation.accuracy).toBeGreaterThanOrEqual(0);
    expect(evaluation.accuracy).toBeLessThanOrEqual(1);
    expect(evaluation.averageError).toBeGreaterThanOrEqual(0);
  });

  it('provides training history', () => {
    trainer.runTrainingCycle();
    trainer.runTrainingCycle();

    const history = trainer.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]!.cycleNumber).toBe(1);
    expect(history[1]!.cycleNumber).toBe(2);
  });
});
