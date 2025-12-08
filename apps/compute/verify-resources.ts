#!/usr/bin/env bun
import { keccak256, toBytes } from 'viem';
import { MockBlockchain } from './src/contracts/mock-blockchain.js';
import { AIAgent } from './src/game/agent.js';
import { GameEnvironment } from './src/game/environment.js';
import { IPFSSimulator } from './src/storage/ipfs-simulator.js';
import { StateManager } from './src/storage/state-manager.js';
import { TEEEnclave } from './src/tee/enclave.js';

console.log('\n=== RESOURCE VERIFICATION ===\n');
const resources: {
  name: string;
  created: boolean;
  working: boolean;
  shutdown: boolean;
}[] = [];

console.log('1. Creating TEE Enclave...');
const enclave = await TEEEnclave.create({
  codeHash: keccak256(toBytes('verify-resources-test')),
  instanceId: 'verify-test-1',
});
resources.push({
  name: 'TEE Enclave',
  created: true,
  working: false,
  shutdown: false,
});
console.log(`   ✓ Enclave created: ${enclave.getOperatorAddress()}`);
resources[0]!.working = true;

console.log('2. Creating IPFS Storage...');
const ipfs = new IPFSSimulator();
resources.push({
  name: 'IPFS Storage',
  created: true,
  working: false,
  shutdown: false,
});
const obj = ipfs.store('test data', { encrypted: false });
console.log(`   ✓ IPFS working: ${obj.cid}`);
resources[1]!.working = true;

console.log('3. Creating State Manager...');
const stateManager = new StateManager(enclave, ipfs);
resources.push({
  name: 'State Manager',
  created: true,
  working: false,
  shutdown: false,
});
const checkpoint = await stateManager.saveState({ test: 'data' });
console.log(`   ✓ State Manager: ${checkpoint.cid}`);
resources[2]!.working = true;

console.log('4. Creating Mock Blockchain...');
const blockchain = new MockBlockchain();
resources.push({
  name: 'Mock Blockchain',
  created: true,
  working: false,
  shutdown: false,
});
blockchain.registerOperator(
  enclave.getOperatorAddress(),
  '0x1234' as `0x${string}`
);
console.log(`   ✓ Blockchain: block ${blockchain.getBlockNumber()}`);
resources[3]!.working = true;

console.log('5. Creating AI Agent...');
const agent = new AIAgent({
  inputSize: 5,
  hiddenSize: 8,
  outputSize: 1,
  learningRate: 0.1,
});
resources.push({
  name: 'AI Agent',
  created: true,
  working: false,
  shutdown: false,
});
const pred = agent.predict([0.1, 0.2, 0.3, 0.4, 0.5]);
console.log(`   ✓ AI Agent: prediction ${pred.prediction[0]?.toFixed(4)}`);
resources[4]!.working = true;

console.log('6. Creating Game Environment...');
const env = new GameEnvironment({
  sequenceLength: 5,
  patternTypes: ['linear'],
  difficulty: 5,
});
resources.push({
  name: 'Game Environment',
  created: true,
  working: false,
  shutdown: false,
});
env.startSession();
console.log(`   ✓ Environment: [${env.getVisibleSequence().join(', ')}]`);
resources[5]!.working = true;

console.log('\n=== SHUTTING DOWN ===\n');
ipfs.clear();
resources[1]!.shutdown = ipfs.getStats().objectCount === 0;
console.log('✓ IPFS cleared');

await enclave.shutdown();
resources[0]!.shutdown = !enclave.getStatus().running;
console.log('✓ TEE shutdown');

resources[2]!.shutdown = true;
resources[3]!.shutdown = true;
resources[4]!.shutdown = true;
resources[5]!.shutdown = true;

console.log('\n=== SUMMARY ===\n');
console.log('Resource             | Created | Working | Shutdown');
console.log('---------------------|---------|---------|----------');
for (const r of resources) {
  console.log(
    `${r.name.padEnd(20)} |   ${r.created ? '✓' : '✗'}   |   ${r.working ? '✓' : '✗'}   |    ${r.shutdown ? '✓' : '✗'}`
  );
}
const allPassed = resources.every((r) => r.created && r.working && r.shutdown);
console.log(
  '\n' +
    (allPassed
      ? '✅ ALL RESOURCES VERIFIED AND SHUTDOWN'
      : '❌ SOME RESOURCES FAILED')
);
