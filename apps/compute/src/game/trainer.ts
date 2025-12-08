/**
 * AI Trainer
 *
 * Coordinates training loops for the AI agent.
 * Simulates daily training cycles as described in the TEE paper.
 */

import type { Hex } from 'viem';
import type { AIAgent, TrainingSample } from './agent.js';
import type { GameEnvironment } from './environment.js';

export interface TrainingConfig {
  batchSize: number;
  epochsPerCycle: number;
  targetLoss: number;
}

export interface TrainingCycleResult {
  cycleNumber: number;
  startTime: number;
  endTime: number;
  epochsRun: number;
  samplesProcessed: number;
  initialLoss: number;
  finalLoss: number;
  modelHashBefore: Hex;
  modelHashAfter: Hex;
  samples: TrainingSample[];
  improved: boolean;
}

/**
 * Manages training cycles for the AI agent
 */
export class AITrainer {
  private config: TrainingConfig;
  private agent: AIAgent;
  private environment: GameEnvironment;
  private cycleHistory: TrainingCycleResult[] = [];
  private cycleCounter = 0;

  constructor(
    config: TrainingConfig,
    agent: AIAgent,
    environment: GameEnvironment
  ) {
    this.config = config;
    this.agent = agent;
    this.environment = environment;
    console.log(
      `[Trainer] Initialized (batch: ${config.batchSize}, epochs: ${config.epochsPerCycle})`
    );
  }

  /**
   * Run a complete training cycle
   * This simulates the "daily training loop" from the paper
   */
  runTrainingCycle(): TrainingCycleResult {
    const startTime = Date.now();
    this.cycleCounter++;

    console.log(`\n[Trainer] === TRAINING CYCLE ${this.cycleCounter} ===`);

    // Record initial state
    const modelHashBefore = this.agent.getModelHash();
    const initialStats = this.agent.getStats();

    // Generate training samples
    const samples = this.environment.generateTrainingBatch(
      this.config.batchSize
    );
    console.log(`[Trainer] Generated ${samples.length} training samples`);

    // Run training epochs
    let epochsRun = 0;
    let currentLoss = initialStats.averageLoss;
    let improved = false;

    for (let epoch = 0; epoch < this.config.epochsPerCycle; epoch++) {
      const result = this.agent.train(samples);
      epochsRun++;
      currentLoss = result.loss;

      if (result.improved) {
        improved = true;
      }

      // Early stopping if we hit target loss
      if (currentLoss < this.config.targetLoss) {
        console.log(
          `[Trainer] Early stop: reached target loss ${currentLoss.toFixed(4)}`
        );
        break;
      }
    }

    const modelHashAfter = this.agent.getModelHash();
    const endTime = Date.now();

    const result: TrainingCycleResult = {
      cycleNumber: this.cycleCounter,
      startTime,
      endTime,
      epochsRun,
      samplesProcessed: samples.length * epochsRun,
      initialLoss: initialStats.averageLoss,
      finalLoss: currentLoss,
      modelHashBefore,
      modelHashAfter,
      samples, // For storing publicly
      improved,
    };

    this.cycleHistory.push(result);

    console.log(
      `[Trainer] Cycle ${this.cycleCounter} complete: ` +
        `loss ${initialStats.averageLoss.toFixed(4)} -> ${currentLoss.toFixed(4)}, ` +
        `${epochsRun} epochs, ${(endTime - startTime) / 1000}s`
    );

    return result;
  }

  /**
   * Run a quick evaluation of the agent
   */
  evaluate(sampleCount = 20): {
    accuracy: number;
    averageError: number;
    samples: Array<{ input: number[]; predicted: number; actual: number }>;
  } {
    const testSamples = this.environment.generateTrainingBatch(sampleCount);
    let correct = 0;
    let totalError = 0;
    const results: Array<{
      input: number[];
      predicted: number;
      actual: number;
    }> = [];

    for (const sample of testSamples) {
      const prediction = this.agent.predict(sample.input);
      const predicted = prediction.prediction[0] ?? 0;
      const actual = sample.target[0] ?? 0;
      const error = Math.abs(predicted - actual);

      totalError += error;

      // Consider "correct" if within 10% tolerance
      if (error < 0.1) {
        correct++;
      }

      results.push({
        input: sample.input,
        predicted,
        actual,
      });
    }

    return {
      accuracy: correct / sampleCount,
      averageError: totalError / sampleCount,
      samples: results,
    };
  }

  /**
   * Get training history
   */
  getHistory(): TrainingCycleResult[] {
    return [...this.cycleHistory];
  }

  /**
   * Get latest cycle result
   */
  getLatestCycle(): TrainingCycleResult | null {
    return this.cycleHistory[this.cycleHistory.length - 1] ?? null;
  }

  /**
   * Get training statistics
   */
  getStats(): {
    totalCycles: number;
    totalSamplesProcessed: number;
    averageImprovement: number;
    currentLoss: number;
  } {
    const agentStats = this.agent.getStats();

    let totalImprovement = 0;
    for (const cycle of this.cycleHistory) {
      totalImprovement += cycle.initialLoss - cycle.finalLoss;
    }

    return {
      totalCycles: this.cycleHistory.length,
      totalSamplesProcessed: this.cycleHistory.reduce(
        (sum, c) => sum + c.samplesProcessed,
        0
      ),
      averageImprovement:
        this.cycleHistory.length > 0
          ? totalImprovement / this.cycleHistory.length
          : 0,
      currentLoss: agentStats.averageLoss,
    };
  }

  /**
   * Get the underlying agent
   */
  getAgent(): AIAgent {
    return this.agent;
  }
}
