/**
 * Game Environment
 *
 * A simple pattern-matching game where the AI agent learns to predict
 * the next value in various sequences.
 */

import type { TrainingSample } from './agent.js';

export interface GameConfig {
  sequenceLength: number;
  patternTypes: PatternType[];
  difficulty: number;
}

export type PatternType =
  | 'linear'
  | 'quadratic'
  | 'fibonacci'
  | 'sine'
  | 'random';

export interface GameSession {
  id: string;
  patternType: PatternType;
  sequence: number[];
  playerGuesses: number[];
  agentGuesses: number[];
  scores: { player: number; agent: number };
  completed: boolean;
}

export interface RoundResult {
  actual: number;
  playerGuess: number;
  agentGuess: number;
  playerCorrect: boolean;
  agentCorrect: boolean;
}

/**
 * Pattern-prediction game environment
 */
export class GameEnvironment {
  private config: GameConfig;
  private sessions: GameSession[] = [];
  private currentSession: GameSession | null = null;
  private sessionCounter = 0;

  constructor(config: GameConfig) {
    this.config = config;
    console.log(
      `[Game] Environment initialized (sequence length: ${config.sequenceLength})`
    );
  }

  /**
   * Generate a sequence based on pattern type
   */
  private generateSequence(
    type: PatternType,
    length: number,
    seed: number
  ): number[] {
    const sequence: number[] = [];

    switch (type) {
      case 'linear': {
        const start = Math.floor(seed % 10);
        const step = Math.floor((seed * 7) % 5) + 1;
        for (let i = 0; i < length; i++) {
          sequence.push(start + step * i);
        }
        break;
      }
      case 'quadratic': {
        const a = Math.floor((seed * 3) % 3) + 1;
        const b = Math.floor((seed * 7) % 5);
        for (let i = 0; i < length; i++) {
          sequence.push(a * i * i + b * i);
        }
        break;
      }
      case 'fibonacci': {
        const offset = Math.floor(seed % 5);
        sequence.push(offset, offset + 1);
        for (let i = 2; i < length; i++) {
          const prev1 = sequence[i - 1] ?? 0;
          const prev2 = sequence[i - 2] ?? 0;
          sequence.push(prev1 + prev2);
        }
        break;
      }
      case 'sine': {
        const amplitude = Math.floor((seed % 5) + 5);
        const phase = (seed * 0.1) % (2 * Math.PI);
        for (let i = 0; i < length; i++) {
          sequence.push(
            Math.round(amplitude * Math.sin(i * 0.5 + phase) + amplitude)
          );
        }
        break;
      }
      case 'random': {
        let val = Math.floor(seed % 20);
        for (let i = 0; i < length; i++) {
          sequence.push(val);
          val = (val * 1103515245 + 12345) % 100;
        }
        break;
      }
    }

    return sequence;
  }

  /**
   * Start a new game session
   */
  startSession(patternType?: PatternType): GameSession {
    const randomType =
      this.config.patternTypes[
        Math.floor(Math.random() * this.config.patternTypes.length)
      ];
    const type: PatternType = patternType ?? randomType ?? 'linear';

    const seed = Date.now() + this.sessionCounter;
    const sequence = this.generateSequence(
      type,
      this.config.sequenceLength + 1,
      seed
    );

    const session: GameSession = {
      id: `session-${++this.sessionCounter}`,
      patternType: type,
      sequence,
      playerGuesses: [],
      agentGuesses: [],
      scores: { player: 0, agent: 0 },
      completed: false,
    };

    this.currentSession = session;
    this.sessions.push(session);

    console.log(`[Game] New session ${session.id} (${type} pattern)`);

    return session;
  }

  /**
   * Get the visible sequence (excluding the answer)
   */
  getVisibleSequence(): number[] {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    return this.currentSession.sequence.slice(0, -1);
  }

  /**
   * Get the sequence as normalized input for the agent
   */
  getAgentInput(): number[] {
    const seq = this.getVisibleSequence();
    // Normalize to 0-1 range
    const max = Math.max(...seq, 1);
    return seq.map((v) => v / max);
  }

  /**
   * Submit guesses and get result
   */
  submitGuesses(playerGuess: number, agentGuess: number): RoundResult {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const actual =
      this.currentSession.sequence[this.currentSession.sequence.length - 1] ??
      0;

    // Score with tolerance based on difficulty
    const tolerance = 10 - this.config.difficulty;
    const playerCorrect = Math.abs(playerGuess - actual) <= tolerance;
    const agentCorrect = Math.abs(agentGuess - actual) <= tolerance;

    this.currentSession.playerGuesses.push(playerGuess);
    this.currentSession.agentGuesses.push(agentGuess);

    if (playerCorrect) this.currentSession.scores.player++;
    if (agentCorrect) this.currentSession.scores.agent++;

    this.currentSession.completed = true;

    console.log(
      `[Game] Round complete: actual=${actual}, player=${playerGuess}${playerCorrect ? '✓' : '✗'}, agent=${agentGuess}${agentCorrect ? '✓' : '✗'}`
    );

    return {
      actual,
      playerGuess,
      agentGuess,
      playerCorrect,
      agentCorrect,
    };
  }

  /**
   * Generate training sample from completed session
   */
  generateTrainingSample(): TrainingSample | null {
    if (!this.currentSession?.completed) return null;

    const input = this.getAgentInput();
    const actual =
      this.currentSession.sequence[this.currentSession.sequence.length - 1] ??
      0;
    const max = Math.max(...this.currentSession.sequence, 1);

    return {
      input,
      target: [actual / max], // Normalized target
      timestamp: Date.now(),
    };
  }

  /**
   * Generate multiple random samples for training
   */
  generateTrainingBatch(batchSize: number): TrainingSample[] {
    const samples: TrainingSample[] = [];

    for (let i = 0; i < batchSize; i++) {
      const randomType =
        this.config.patternTypes[
          Math.floor(Math.random() * this.config.patternTypes.length)
        ];
      const type: PatternType = randomType ?? 'linear';
      const seed = Date.now() + i * 1000 + Math.random() * 1000;
      const sequence = this.generateSequence(
        type,
        this.config.sequenceLength + 1,
        seed
      );

      const max = Math.max(...sequence, 1);
      const input = sequence.slice(0, -1).map((v) => v / max);
      const lastVal = sequence[sequence.length - 1] ?? 0;
      const target = [lastVal / max];

      samples.push({
        input,
        target,
        timestamp: Date.now(),
      });
    }

    return samples;
  }

  /**
   * Get all sessions
   */
  getSessions(): GameSession[] {
    return [...this.sessions];
  }

  /**
   * Get current session
   */
  getCurrentSession(): GameSession | null {
    return this.currentSession;
  }

  /**
   * Get aggregate stats
   */
  getStats(): {
    totalSessions: number;
    playerWins: number;
    agentWins: number;
    ties: number;
  } {
    let playerWins = 0;
    let agentWins = 0;
    let ties = 0;

    for (const session of this.sessions) {
      if (!session.completed) continue;
      if (session.scores.player > session.scores.agent) playerWins++;
      else if (session.scores.agent > session.scores.player) agentWins++;
      else ties++;
    }

    return {
      totalSessions: this.sessions.filter((s) => s.completed).length,
      playerWins,
      agentWins,
      ties,
    };
  }

  /**
   * Reset environment
   */
  reset(): void {
    this.sessions = [];
    this.currentSession = null;
    this.sessionCounter = 0;
    console.log('[Game] Environment reset');
  }
}
