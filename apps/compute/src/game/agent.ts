/**
 * Simple AI Agent
 *
 * A toy neural network agent that learns to predict patterns.
 * This simulates what a real ML model would do in the TEE.
 */

import { type Hex, keccak256, toBytes } from 'viem';

export interface AgentConfig {
  inputSize: number;
  hiddenSize: number;
  outputSize: number;
  learningRate: number;
}

export interface AgentState {
  // Simplified "weights" - just arrays of numbers
  inputWeights: number[][];
  hiddenWeights: number[][];
  bias1: number[];
  bias2: number[];
  // Training stats
  epoch: number;
  totalSamples: number;
  averageLoss: number;
}

export interface TrainingSample {
  input: number[];
  target: number[];
  timestamp: number;
}

export interface PredictionResult {
  prediction: number[];
  confidence: number;
}

/**
 * Simple neural network agent
 * In production, this would be a real PyTorch/TensorFlow model
 */
export class AIAgent {
  private config: AgentConfig;
  private state: AgentState;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = this.initializeState();
    console.log(
      `[AI Agent] Initialized (${config.inputSize} -> ${config.hiddenSize} -> ${config.outputSize})`
    );
  }

  private initializeState(): AgentState {
    const { inputSize, hiddenSize, outputSize } = this.config;

    // Xavier initialization (simplified)
    const scale1 = Math.sqrt(2 / (inputSize + hiddenSize));
    const scale2 = Math.sqrt(2 / (hiddenSize + outputSize));

    return {
      inputWeights: this.randomMatrix(inputSize, hiddenSize, scale1),
      hiddenWeights: this.randomMatrix(hiddenSize, outputSize, scale2),
      bias1: new Array(hiddenSize).fill(0),
      bias2: new Array(outputSize).fill(0),
      epoch: 0,
      totalSamples: 0,
      averageLoss: 1.0,
    };
  }

  private randomMatrix(rows: number, cols: number, scale: number): number[][] {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() - 0.5) * 2 * scale)
    );
  }

  /**
   * Forward pass through the network
   */
  private forward(input: number[]): { hidden: number[]; output: number[] } {
    // Hidden layer: ReLU(input @ inputWeights + bias1)
    const hidden: number[] = new Array(this.config.hiddenSize).fill(
      0
    ) as number[];
    for (let j = 0; j < this.config.hiddenSize; j++) {
      let sum = this.state.bias1[j] ?? 0;
      for (let i = 0; i < input.length; i++) {
        const inputVal = input[i] ?? 0;
        const weightRow = this.state.inputWeights[i];
        const weight = weightRow?.[j] ?? 0;
        sum += inputVal * weight;
      }
      hidden[j] = Math.max(0, sum); // ReLU
    }

    // Output layer: sigmoid(hidden @ hiddenWeights + bias2)
    const output: number[] = new Array(this.config.outputSize).fill(
      0
    ) as number[];
    for (let j = 0; j < this.config.outputSize; j++) {
      let sum = this.state.bias2[j] ?? 0;
      for (let i = 0; i < this.config.hiddenSize; i++) {
        const hiddenVal = hidden[i] ?? 0;
        const weightRow = this.state.hiddenWeights[i];
        const weight = weightRow?.[j] ?? 0;
        sum += hiddenVal * weight;
      }
      output[j] = 1 / (1 + Math.exp(-sum)); // Sigmoid
    }

    return { hidden, output };
  }

  /**
   * Make a prediction
   */
  predict(input: number[]): PredictionResult {
    const { output } = this.forward(input);

    // Confidence = average activation strength
    const confidence =
      output.reduce((sum, v) => sum + Math.abs(v - 0.5), 0) /
      output.length /
      0.5;

    return {
      prediction: output,
      confidence: Math.min(1, confidence),
    };
  }

  /**
   * Train on a batch of samples
   * Uses simplified backpropagation
   */
  train(samples: TrainingSample[]): { loss: number; improved: boolean } {
    const lr = this.config.learningRate;
    let totalLoss = 0;

    for (const sample of samples) {
      const { hidden, output } = this.forward(sample.input);

      // Compute loss (MSE)
      let sampleLoss = 0;
      const outputGrad: number[] = new Array(this.config.outputSize).fill(
        0
      ) as number[];
      for (let i = 0; i < this.config.outputSize; i++) {
        const outputVal = output[i] ?? 0;
        const targetVal = sample.target[i] ?? 0;
        const error = outputVal - targetVal;
        sampleLoss += error * error;
        // Gradient: error * sigmoid'(output)
        outputGrad[i] = error * outputVal * (1 - outputVal);
      }
      totalLoss += sampleLoss / this.config.outputSize;

      // Backpropagate through hidden layer
      const hiddenGrad: number[] = new Array(this.config.hiddenSize).fill(
        0
      ) as number[];
      for (let i = 0; i < this.config.hiddenSize; i++) {
        let sum = 0;
        for (let j = 0; j < this.config.outputSize; j++) {
          const outGrad = outputGrad[j] ?? 0;
          const weightRow = this.state.hiddenWeights[i];
          const weight = weightRow?.[j] ?? 0;
          sum += outGrad * weight;
        }
        // ReLU gradient
        const hiddenVal = hidden[i] ?? 0;
        hiddenGrad[i] = hiddenVal > 0 ? sum : 0;
      }

      // Update weights
      // Hidden -> Output weights
      for (let i = 0; i < this.config.hiddenSize; i++) {
        const weightRow = this.state.hiddenWeights[i];
        if (!weightRow) continue;
        for (let j = 0; j < this.config.outputSize; j++) {
          const outGrad = outputGrad[j] ?? 0;
          const hiddenVal = hidden[i] ?? 0;
          weightRow[j] = (weightRow[j] ?? 0) - lr * outGrad * hiddenVal;
        }
      }
      // Output biases
      for (let j = 0; j < this.config.outputSize; j++) {
        const outGrad = outputGrad[j] ?? 0;
        this.state.bias2[j] = (this.state.bias2[j] ?? 0) - lr * outGrad;
      }

      // Input -> Hidden weights
      for (let i = 0; i < sample.input.length; i++) {
        const weightRow = this.state.inputWeights[i];
        if (!weightRow) continue;
        for (let j = 0; j < this.config.hiddenSize; j++) {
          const hidGrad = hiddenGrad[j] ?? 0;
          const inputVal = sample.input[i] ?? 0;
          weightRow[j] = (weightRow[j] ?? 0) - lr * hidGrad * inputVal;
        }
      }
      // Hidden biases
      for (let j = 0; j < this.config.hiddenSize; j++) {
        const hidGrad = hiddenGrad[j] ?? 0;
        this.state.bias1[j] = (this.state.bias1[j] ?? 0) - lr * hidGrad;
      }
    }

    const avgLoss = totalLoss / samples.length;
    const improved = avgLoss < this.state.averageLoss;

    this.state.epoch++;
    this.state.totalSamples += samples.length;
    this.state.averageLoss = avgLoss;

    return { loss: avgLoss, improved };
  }

  /**
   * Get model hash (commitment to model state)
   */
  getModelHash(): Hex {
    const stateString = JSON.stringify({
      inputWeights: this.state.inputWeights.map((row) =>
        row.map((v) => v.toFixed(6))
      ),
      hiddenWeights: this.state.hiddenWeights.map((row) =>
        row.map((v) => v.toFixed(6))
      ),
      bias1: this.state.bias1.map((v) => v.toFixed(6)),
      bias2: this.state.bias2.map((v) => v.toFixed(6)),
    });
    return keccak256(toBytes(stateString));
  }

  /**
   * Serialize agent state
   */
  serialize(): AgentState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Load agent state
   */
  loadState(state: AgentState): void {
    this.state = JSON.parse(JSON.stringify(state));
    console.log(
      `[AI Agent] Loaded state (epoch ${state.epoch}, loss ${state.averageLoss.toFixed(4)})`
    );
  }

  /**
   * Get training stats
   */
  getStats(): {
    epoch: number;
    totalSamples: number;
    averageLoss: number;
    modelHash: Hex;
  } {
    return {
      epoch: this.state.epoch,
      totalSamples: this.state.totalSamples,
      averageLoss: this.state.averageLoss,
      modelHash: this.getModelHash(),
    };
  }
}
