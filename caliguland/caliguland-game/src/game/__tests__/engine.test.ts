/**
 * Game Engine Tests
 * 
 * To run: npm test (add jest configuration first)
 */

import { GameEngine } from '../engine';
import { Agent, Outcome } from '../../types';

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine({
      gameDurationMs: 60000, // 1 minute for testing
      maxPlayers: 10,
      minPlayers: 2
    });
    
    // Mock broadcast functions
    engine.setBroadcastFunctions(
      (msg) => console.log('Broadcast:', msg),
      (id, msg) => console.log(`Send to ${id}:`, msg)
    );
  });

  afterEach(() => {
    engine.stop();
  });

  describe('Lobby', () => {
    it('should accept agents to lobby', () => {
      const agent: Agent = {
        id: 'test-agent-1',
        name: 'Test Agent',
        type: 'human',
        reputation: 50,
        wins: 0
      };

      const joined = engine.joinLobby(agent);
      expect(joined).toBe(true);
    });

    it('should reject agents when lobby is full', () => {
      // Fill lobby to max
      for (let i = 0; i < 10; i++) {
        engine.joinLobby({
          id: `agent-${i}`,
          name: `Agent ${i}`,
          type: 'human',
          reputation: 50,
          wins: 0
        });
      }

      // Try to add one more
      const rejected = engine.joinLobby({
        id: 'agent-overflow',
        name: 'Overflow',
        type: 'human',
        reputation: 50,
        wins: 0
      });

      expect(rejected).toBe(false);
    });
  });

  describe('Game Start', () => {
    it('should start game when minimum players reached', (done) => {
      // Add minimum players
      for (let i = 0; i < 2; i++) {
        engine.joinLobby({
          id: `agent-${i}`,
          name: `Agent ${i}`,
          type: 'human',
          reputation: 50,
          wins: 0
        });
      }

      engine.start();

      // Wait for game to start (tick interval)
      setTimeout(() => {
        const game = engine.getCurrentGame();
        expect(game).not.toBeNull();
        expect(game?.agents.length).toBe(2);
        done();
      }, 11000); // Wait for first tick
    });
  });

  describe('Betting', () => {
    it('should accept valid bets', () => {
      // Setup game with mock
      // TODO: Implement after game start mocking
    });

    it('should update market odds after bet', () => {
      // TODO: Implement
    });

    it('should reject bets after betting closes', () => {
      // TODO: Implement
    });
  });

  describe('Feed', () => {
    it('should add posts to feed', () => {
      // TODO: Implement
    });

    it('should broadcast new posts', () => {
      // TODO: Implement
    });
  });
});

// Note: This is a basic test structure. 
// Install Jest and configure package.json to run tests:
//
// package.json:
// {
//   "scripts": {
//     "test": "jest"
//   },
//   "devDependencies": {
//     "@types/jest": "^29.5.0",
//     "jest": "^29.5.0",
//     "ts-jest": "^29.1.0"
//   }
// }
//
// jest.config.js:
// module.exports = {
//   preset: 'ts-jest',
//   testEnvironment: 'node',
//   testMatch: ['**/__tests__/**/*.test.ts']
// };

