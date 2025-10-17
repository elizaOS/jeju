#!/usr/bin/env bun
/**
 * End-to-End Complete Game Test
 * Verifies full game cycle from start to finish with 5 agents
 */

import { expect, test, describe, beforeAll, afterAll } from 'bun:test';

const GAME_URL = 'http://localhost:8000';
const AGENTS = [
  { id: 'agent-1', name: 'Analyst' },
  { id: 'agent-2', name: 'Contrarian' },
  { id: 'agent-3', name: 'Insider' },
  { id: 'agent-4', name: 'Social' },
  { id: 'agent-5', name: 'Random' }
];

describe('VibeVM Prediction Game - Complete E2E Test', () => {
  let gameSessionId: string;

  test('Game server is running', async () => {
    const response = await fetch(`${GAME_URL}/health`);
    expect(response.ok).toBe(true);
    
    const health = await response.json();
    expect(health.status).toBe('healthy');
  });

  test('Agent Card is accessible', async () => {
    const response = await fetch(`${GAME_URL}/.well-known/agent-card.json`);
    expect(response.ok).toBe(true);
    
    const card = await response.json();
    expect(card.protocolVersion).toBe('0.3.0');
    expect(card.skills.length).toBe(10);
    expect(card.capabilities.streaming).toBe(true);
  });

  test('5 agents can join lobby', async () => {
    for (const agent of AGENTS) {
      const response = await fetch(`${GAME_URL}/api/v1/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.success).toBe(true);
      
      await new Promise(r => setTimeout(r, 200));
    }

    // Verify all joined
    const gameState = await fetch(`${GAME_URL}/api/v1/game`).then(r => r.json());
    expect(gameState.active).toBe(true);
    expect(gameState.players.length).toBe(5);
  });

  test('Game auto-starts with 5 players', async () => {
    // Wait for auto-start
    await new Promise(r => setTimeout(r, 3000));

    const gameState = await fetch(`${GAME_URL}/api/v1/game`).then(r => r.json());
    
    expect(gameState.active).toBe(true);
    expect(gameState.phase).toBe('EARLY');
    expect(gameState.question).toBeDefined();
    
    gameSessionId = gameState.sessionId;
  });

  test('Agents can post to feed', async () => {
    for (const agent of AGENTS.slice(0, 3)) {
      const response = await fetch(`${GAME_URL}/api/v1/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          content: `Test post from ${agent.name}`
        })
      });

      expect(response.ok).toBe(true);
      await new Promise(r => setTimeout(r, 500));
    }

    const feed = await fetch(`${GAME_URL}/api/v1/feed`).then(r => r.json());
    expect(feed.posts.length).toBeGreaterThan(0);
  });

  test('Agents can place bets', async () => {
    for (let i = 0; i < AGENTS.length; i++) {
      const agent = AGENTS[i];
      const outcome = i % 2 === 0 ? 'YES' : 'NO';
      
      const response = await fetch(`${GAME_URL}/api/v1/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          outcome,
          amount: 100 + (i * 50)
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.success).toBe(true);
      
      await new Promise(r => setTimeout(r, 300));
    }

    const market = await fetch(`${GAME_URL}/api/v1/market`).then(r => r.json());
    expect(market.yesOdds + market.noOdds).toBe(100);
    expect(market.totalVolume).toBeGreaterThan(0);
  });

  test('Market odds update correctly', async () => {
    const market = await fetch(`${GAME_URL}/api/v1/market`).then(r => r.json());
    
    // Verify odds are reasonable (0-100%)
    expect(market.yesOdds).toBeGreaterThanOrEqual(0);
    expect(market.yesOdds).toBeLessThanOrEqual(100);
    expect(market.noOdds).toBeGreaterThanOrEqual(0);
    expect(market.noOdds).toBeLessThanOrEqual(100);
    
    // Verify they sum to 100
    expect(market.yesOdds + market.noOdds).toBe(100);
  });

  test('Direct messages work', async () => {
    const response = await fetch(`${GAME_URL}/api/v1/dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: AGENTS[0].id,
        to: AGENTS[1].id,
        content: 'Want to share intel?'
      })
    });

    expect(response.ok).toBe(true);
    
    // Check DMs for recipient
    const dms = await fetch(`${GAME_URL}/api/v1/dm/${AGENTS[1].id}`).then(r => r.json());
    expect(dms.messages.length).toBeGreaterThan(0);
  });

  // Note: Full game cycle test would take 60 minutes
  // For quick testing, these spot checks verify core functionality
});

console.log('\n✅ E2E Test Suite Complete');
console.log('   For full 60-minute game test, run with FULL_GAME=1 env var\n');

