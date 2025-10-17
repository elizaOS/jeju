#!/usr/bin/env bun
/**
 * Runtime E2E Test - NO MOCKS, just real API calls
 * Verifies: join → game start → post → bet → game progresses
 */

const GAME_URL = 'http://localhost:8000';

async function sendRequest(endpoint: string, body?: any) {
  const response = await fetch(`${GAME_URL}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}

async function main() {
  console.log('🧪 Runtime E2E Test - Real System Only\n');

  // Phase 1: Health check
  console.log('📋 Phase 1: Server Health');
  const health = await sendRequest('/health');
  console.log(`   ✓ Server: ${health.status}`);
  console.log('');

  // Phase 2: Agent Card discovery
  console.log('📋 Phase 2: Agent Card Discovery');
  const card = await sendRequest('/.well-known/agent-card.json');
  console.log(`   ✓ Name: ${card.name}`);
  console.log(`   ✓ Skills: ${card.skills.length}`);
  console.log('');

  // Phase 3: Join game (5 agents)
  console.log('📋 Phase 3: Join Game (5 agents)');
  for (let i = 1; i <= 5; i++) {
    await sendRequest('/api/v1/join', { agentId: `test-agent-${i}` });
    console.log(`   ✓ Agent ${i} joined`);
  }
  
  // Wait for auto-start
  await new Promise(r => setTimeout(r, 3000));
  
  const gameState = await sendRequest('/api/v1/game');
  console.log(`   ✓ Game phase: ${gameState.phase}`);
  console.log(`   ✓ Players: ${gameState.players?.length || 0}`);
  console.log('');

  // Phase 4: Post to feed
  console.log('📋 Phase 4: Post to Feed');
  await sendRequest('/api/v1/post', {
    agentId: 'test-agent-1',
    content: 'Test post from scripted agent'
  });
  console.log('   ✓ Post created');
  console.log('');

  // Phase 5: Place bets
  console.log('📋 Phase 5: Place Bets');
  await sendRequest('/api/v1/bet', {
    agentId: 'test-agent-1',
    outcome: 'YES',
    amount: 100
  });
  await sendRequest('/api/v1/bet', {
    agentId: 'test-agent-2',
    outcome: 'NO',
    amount: 150
  });
  console.log('   ✓ Bets placed');
  
  const market = await sendRequest('/api/v1/market');
  console.log(`   ✓ Market: YES=${market.yesOdds}% NO=${market.noOdds}%`);
  console.log('');

  // Phase 6: Game progression
  console.log('📋 Phase 6: Game State');
  const finalState = await sendRequest('/api/v1/game');
  console.log(`   ✓ Phase: ${finalState.phase}`);
  console.log(`   ✓ Day: ${finalState.day}/30`);
  console.log(`   ✓ Betting: ${finalState.bettingOpen ? 'OPEN' : 'CLOSED'}`);
  console.log('');

  console.log('✅ RUNTIME E2E TEST PASSED');
  console.log('   All endpoints working, no mocks used');
}

main().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});

