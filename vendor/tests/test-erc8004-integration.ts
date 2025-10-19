#!/usr/bin/env bun
/**
 * ERC-8004 Integration Test Runner
 * Tests cross-game A2A discovery and registration
 * Runs real servers and real blockchain
 */

import { $ } from 'bun';
import { spawn } from 'bun';

console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║                                                                       ║');
console.log('║   🧪 ERC-8004 Cross-Game Integration Test Suite                   ║');
console.log('║                                                                       ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

const processes: Array<{ name: string; proc: ReturnType<typeof spawn> }> = [];
let testsRunning = false;

async function cleanup() {
  console.log('\n🧹 Cleaning up...');
  
  for (const { name, proc } of processes) {
    console.log(`  Stopping ${name}...`);
    proc.kill();
  }
  
  if (!testsRunning) {
    process.exit(0);
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function main() {
  try {
    // 1. Start localnet
    console.log('📡 Phase 1: Starting localnet...\n');
    await $`bun run scripts/localnet/start.ts`.quiet();
    console.log('✅ Localnet running\n');

    // 2. Deploy contracts
    console.log('📜 Phase 2: Deploying ERC-8004 contracts...\n');
    await $`cd contracts && forge script script/DeployLiquiditySystem.s.sol:DeployLiquiditySystem --rpc-url http://localhost:8545 --broadcast`.quiet();
    console.log('✅ Contracts deployed\n');

    // 3. Start Caliguland game server
    console.log('🎮 Phase 3: Starting Caliguland game server...\n');
    const caligulandProc = spawn({
      cmd: ['bun', 'run', 'dev'],
      cwd: process.cwd() + '/vendor/caliguland/caliguland-game',
      env: {
        ...process.env,
        PORT: '5008',
        ENABLE_BLOCKCHAIN: 'true',
        RPC_URL: 'http://localhost:8545',
        SERVER_URL: 'http://localhost:5008'
      },
      stdout: 'pipe',
      stderr: 'pipe'
    });
    processes.push({ name: 'Caliguland', proc: caligulandProc });

    // 4. Start Hyperscape game server
    console.log('🎮 Phase 4: Starting Hyperscape game server...\n');
    const hyperscapeProc = spawn({
      cmd: ['bun', 'run', 'dev'],
      cwd: process.cwd() + '/vendor/hyperscape/packages/server',
      env: {
        ...process.env,
        PORT: '5555',
        ENABLE_BLOCKCHAIN: 'true',
        RPC_URL: 'http://localhost:8545',
        SERVER_URL: 'http://localhost:5555',
        USE_LOCAL_POSTGRES: 'false',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hyperscape_test'
      },
      stdout: 'pipe',
      stderr: 'pipe'
    });
    processes.push({ name: 'Hyperscape', proc: hyperscapeProc });

    // Wait for servers to start
    console.log('⏳ Waiting for servers to initialize...\n');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 5. Check agent cards are accessible
    console.log('🔍 Phase 5: Verifying agent cards...\n');
    
    const caligulandCard = await fetch('http://localhost:5008/.well-known/agent-card.json')
      .then(r => r.json())
      .catch(() => null);
    
    const hyperscapeCard = await fetch('http://localhost:5555/.well-known/agent-card.json')
      .then(r => r.json())
      .catch(() => null);

    if (caligulandCard) {
      console.log(`✅ Caliguland: ${caligulandCard.name} - ${caligulandCard.skills.length} skills`);
    } else {
      console.log('❌ Caliguland agent card not accessible');
    }

    if (hyperscapeCard) {
      console.log(`✅ Hyperscape: ${hyperscapeCard.name} - ${hyperscapeCard.skills.length} skills`);
    } else {
      console.log('❌ Hyperscape agent card not accessible');
    }

    // 6. Run integration tests
    console.log('\n📊 Phase 6: Running integration tests...\n');
    testsRunning = true;
    
    const testResult = await $`bun test vendor/tests/erc8004-cross-game.test.ts`.nothrow();
    testsRunning = false;

    if (testResult.exitCode === 0) {
      console.log('\n✅ All tests PASSED!\n');
    } else {
      console.log('\n❌ Some tests FAILED\n');
      process.exitCode = 1;
    }

    // 7. Cleanup
    await cleanup();

  } catch (error) {
    console.error('\n❌ Error:', error);
    await cleanup();
    process.exit(1);
  }
}

main();

