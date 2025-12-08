/**
 * Game Module Exports
 */

export {
  type AgentConfig,
  type AgentState,
  AIAgent,
  type PredictionResult,
  type TrainingSample,
} from './agent.js';

export {
  type GameConfig,
  GameEnvironment,
  type GameSession,
  type PatternType,
  type RoundResult,
} from './environment.js';

export {
  AITrainer,
  type TrainingConfig,
  type TrainingCycleResult,
} from './trainer.js';
