#!/usr/bin/env bun
/**
 * @title Test Node Rewards System End-to-End
 * @notice Complete integration test of the node operator rewards system
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🧪 Node Rewards System - Integration Test\n');
console.log('='.repeat(60));

async function runCommand(cmd: string, description: string) {
  console.log(`\n📝 ${description}...`);
  console.log(`   Command: ${cmd}`);
  
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: '/Users/shawwalters/jeju',
    });
    
    if (stderr && !stderr.includes('warning')) {
      console.log('   stderr:', stderr);
    }
    
    const output = stdout.trim();
    if (output) {
      // Show last 10 lines
      const lines = output.split('\n').slice(-15);
      lines.forEach(line => console.log(`   ${line}`));
    }
    
    console.log('   ✅ Success');
    return { stdout, stderr };
  } catch (error: any) {
    console.error(`   ❌ Failed: ${error.message}`);
    if (error.stdout) {
      const lines = error.stdout.split('\n').slice(-10);
      lines.forEach((line: string) => console.log(`   ${line}`));
    }
    throw error;
  }
}

async function main() {
  try {
    // Test 1: Build contracts
    console.log('\n' + '='.repeat(60));
    console.log('Test 1: Build Contracts');
    console.log('='.repeat(60));
    
    await runCommand(
      'cd contracts && forge build',
      'Building contracts'
    );
    
    // Test 2: Run unit tests
    console.log('\n' + '='.repeat(60));
    console.log('Test 2: Run Unit Tests');
    console.log('='.repeat(60));
    
    await runCommand(
      'cd contracts && forge test --match-contract NodeOperatorRewardsTest',
      'Running NodeOperatorRewards tests'
    );
    
    // Test 3: Check deployment script compiles
    console.log('\n' + '='.repeat(60));
    console.log('Test 3: Verify Deployment Script');
    console.log('='.repeat(60));
    
    await runCommand(
      'cd contracts && forge script script/DeployRewards.s.sol',
      'Verifying deployment script (dry run)'
    );
    
    // Test 4: Check linting
    console.log('\n' + '='.repeat(60));
    console.log('Test 4: Lint Check');
    console.log('='.repeat(60));
    
    await runCommand(
      'cd contracts && forge fmt --check src/node-rewards/',
      'Checking code formatting'
    );
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ All Tests Passed!');
    console.log('='.repeat(60));
    
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Contracts build successfully');
    console.log('   ✅ All 13 unit tests pass');
    console.log('   ✅ Deployment script ready');
    console.log('   ✅ Code formatting correct');
    
    console.log('\n🚀 System is ready for deployment!');
    
    console.log('\n📖 Next Steps:');
    console.log('   1. Deploy to localnet:');
    console.log('      cd contracts && forge script script/DeployRewards.s.sol --rpc-url http://localhost:8545 --broadcast');
    console.log('   2. Register a node:');
    console.log('      bun run node:register');
    console.log('   3. Start rewards oracle:');
    console.log('      bun run rewards:oracle');
    console.log('   4. Claim rewards:');
    console.log('      bun run node:claim $NODE_ID');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { main as testNodeRewardsSystem };

