/**
 * Game Configuration
 * Centralized configuration for the prediction game
 */

export const config = {
  // Server
  port: parseInt(process.env.PORT || '8000'),
  
  // Game timing
  gameDurationMs: parseInt(process.env.GAME_DURATION_MS || '3600000'), // 60 min
  tickIntervalMs: 10000, // Check game state every 10s
  debriefDurationMs: 300000, // 5 min post-game
  
  // Player limits
  maxPlayers: parseInt(process.env.MAX_PLAYERS || '20'),
  minPlayers: parseInt(process.env.MIN_PLAYERS || '5'),
  
  // Game mechanics
  insiderCluePercentage: 0.3, // 30% of players get clues
  insiderClueAccuracy: 0.7, // 70% are truthful
  
  // Betting
  startingTokens: 1000,
  maxBetAmount: 1000,
  minBetAmount: 10,
  
  // Feed
  maxPostLength: 280,
  maxFeedHistory: 1000,
  
  // Direct messages
  maxDMLength: 1000,
  
  // TEE
  dstackSocketPath: process.env.DSTACK_SOCKET_PATH || '/var/run/dstack.sock',
  
  // Paths for key derivation
  paths: {
    oracleSigningKey: '/game/oracle/signing',
    outcomeCommitment: '/game/commitment',
    sessionEncryption: '/game/session/encryption'
  }
};

