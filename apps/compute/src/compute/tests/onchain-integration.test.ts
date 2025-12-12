/**
 * On-Chain Integration Tests
 * 
 * Tests contract target execution, on-chain sync, and prepaid functions
 * against a local Anvil node. Skips gracefully if no node available.
 * 
 * Coverage:
 * - Contract target execution with/without args ✓
 * - Contract revert handling ✓
 * - Wallet requirement validation ✓
 * - Prepaid functions without registry (edge cases) ✓
 * - Sync without registry address (edge case) ✓
 * 
 * Requires TriggerRegistry deployment for full coverage:
 * - syncFromOnChain with real registry
 * - registerOnChain with real registry
 * - recordOnChain with real registry
 * - depositPrepaid/withdrawPrepaid with real registry
 * 
 * To run with full registry: deploy TriggerRegistry and set TRIGGER_REGISTRY_ADDRESS
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { Wallet, JsonRpcProvider, Contract, ContractFactory } from 'ethers';
import {
  TriggerIntegration,
  createTriggerIntegration,
  type ContractTarget,
} from '../sdk/trigger-integration';
import type { Address } from 'viem';

const RPC_URL = process.env.JEJU_RPC_URL || 'http://127.0.0.1:8545';
const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Simple counter contract - compiled with forge
const COUNTER_ABI = [
  'function increment() public',
  'function incrementBy(uint256 n) public',
  'function count() public view returns (uint256)',
];
const COUNTER_BYTECODE = '0x6080604052348015600e575f5ffd5b506102258061001c5f395ff3fe608060405234801561000f575f5ffd5b506004361061003f575f3560e01c806303df179c1461004357806306661abd1461005f578063d09de08a1461007d575b5f5ffd5b61005d600480360381019061005891906100f5565b610087565b005b6100676100a1565b604051610074919061012f565b60405180910390f35b6100856100a6565b005b805f5f8282546100979190610175565b9250508190555050565b5f5481565b5f5f8154809291906100b7906101a8565b9190505550565b5f5ffd5b5f819050919050565b6100d4816100c2565b81146100de575f5ffd5b50565b5f813590506100ef816100cb565b92915050565b5f6020828403121561010a576101096100be565b5b5f610117848285016100e1565b91505092915050565b610129816100c2565b82525050565b5f6020820190506101425f830184610120565b92915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f61017f826100c2565b915061018a836100c2565b92508282019050808211156101a2576101a1610148565b5b92915050565b5f6101b2826100c2565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82036101e4576101e3610148565b5b60018201905091905056fea2646970667358221220f0d704c46b635561390562b9cb4fbdde2021a115b03624997e8cc5e075e2dc2f64736f6c634300081e0033';

let networkAvailable = false;
let provider: JsonRpcProvider;
let wallet: Wallet;
let counterAddress: string;

async function checkNetwork(): Promise<boolean> {
  try {
    provider = new JsonRpcProvider(RPC_URL);
    await provider.getBlockNumber();
    wallet = new Wallet(ANVIL_PRIVATE_KEY, provider);
    return true;
  } catch {
    return false;
  }
}

async function deployCounter(): Promise<string> {
  const factory = new ContractFactory(COUNTER_ABI, COUNTER_BYTECODE, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return await contract.getAddress();
}

describe('On-Chain Integration', () => {
  beforeAll(async () => {
    networkAvailable = await checkNetwork();
    if (networkAvailable) {
      counterAddress = await deployCounter();
      console.log('[Test] Counter deployed at', counterAddress);
    } else {
      console.log('[Test] Skipping on-chain tests - no local node at', RPC_URL);
    }
  });

  describe('Contract Target Execution', () => {
    let integration: TriggerIntegration;

    beforeEach(async () => {
      if (!networkAvailable) return;
      integration = createTriggerIntegration({
        rpcUrl: RPC_URL,
        enableOnChainRegistration: false,
        executorWallet: wallet,
        chainId: 31337,
      });
      await integration.initialize();
    });

    afterEach(async () => {
      if (integration) await integration.shutdown();
    });

    test('executes contract target with no args', async () => {
      if (!networkAvailable) { console.log('   Skipping: no network'); return; }

      const triggerId = await integration.registerTrigger({
        source: 'local',
        type: 'event',
        name: 'increment-counter',
        eventTypes: ['increment'],
        target: {
          type: 'contract',
          address: counterAddress as Address,
          functionName: 'increment',
          abi: 'function increment() public',
        } as ContractTarget,
        active: true,
      });

      const counter = new Contract(counterAddress, COUNTER_ABI, provider);
      const countBefore = await counter.count();

      const result = await integration.executeTrigger({ triggerId });

      expect(result.status).toBe('success');
      expect(result.output).toBeDefined();
      expect(result.output!.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.output!.blockNumber).toBeGreaterThan(0);

      const countAfter = await counter.count();
      expect(countAfter).toBe(countBefore + 1n);
    });

    test('executes contract target with dynamic args', async () => {
      if (!networkAvailable) { console.log('   Skipping: no network'); return; }

      const triggerId = await integration.registerTrigger({
        source: 'local',
        type: 'event',
        name: 'increment-by',
        eventTypes: ['increment-by'],
        target: {
          type: 'contract',
          address: counterAddress as Address,
          functionName: 'incrementBy',
          abi: 'function incrementBy(uint256 n) public',
          args: ['{{n}}'],
        } as ContractTarget,
        active: true,
      });

      const counter = new Contract(counterAddress, COUNTER_ABI, provider);
      const countBefore = await counter.count();

      const result = await integration.executeTrigger({
        triggerId,
        input: { n: 5 },
      });

      expect(result.status).toBe('success');
      expect(result.output!.txHash).toMatch(/^0x[a-f0-9]{64}$/);

      const countAfter = await counter.count();
      expect(countAfter).toBe(countBefore + 5n);
    });

    test('fails without executor wallet', async () => {
      if (!networkAvailable) { console.log('   Skipping: no network'); return; }

      const noWalletIntegration = createTriggerIntegration({
        rpcUrl: RPC_URL,
        enableOnChainRegistration: false,
        chainId: 31337,
      });
      await noWalletIntegration.initialize();

      const triggerId = await noWalletIntegration.registerTrigger({
        source: 'local',
        type: 'event',
        name: 'will-fail',
        eventTypes: ['fail'],
        target: {
          type: 'contract',
          address: counterAddress as Address,
          functionName: 'increment',
          abi: 'function increment() public',
        } as ContractTarget,
        active: true,
      });

      await expect(noWalletIntegration.executeTrigger({ triggerId }))
        .rejects.toThrow('Wallet required for contract calls');

      await noWalletIntegration.shutdown();
    });

    test('handles contract revert', async () => {
      if (!networkAvailable) { console.log('   Skipping: no network'); return; }

      const triggerId = await integration.registerTrigger({
        source: 'local',
        type: 'event',
        name: 'will-revert',
        eventTypes: ['revert'],
        target: {
          type: 'contract',
          address: counterAddress as Address,
          functionName: 'nonExistentFunction',
          abi: 'function nonExistentFunction() public',
        } as ContractTarget,
        active: true,
      });

      await expect(integration.executeTrigger({ triggerId })).rejects.toThrow();
    });
  });

  describe('Prepaid Balance Functions', () => {
    test('getPrepaidBalance returns 0n without registry', async () => {
      const integration = createTriggerIntegration({
        rpcUrl: RPC_URL,
        enableOnChainRegistration: false,
        chainId: 31337,
      });
      await integration.initialize();

      const balance = await integration.getPrepaidBalance('0x1234567890123456789012345678901234567890' as Address);
      expect(balance).toBe(0n);

      await integration.shutdown();
    });

    test('depositPrepaid throws without registry', async () => {
      const integration = createTriggerIntegration({
        rpcUrl: RPC_URL,
        enableOnChainRegistration: false,
        executorWallet: wallet,
        chainId: 31337,
      });
      await integration.initialize();

      await expect(integration.depositPrepaid(1000n))
        .rejects.toThrow('Registry and wallet required');

      await integration.shutdown();
    });

    test('withdrawPrepaid throws without registry', async () => {
      const integration = createTriggerIntegration({
        rpcUrl: RPC_URL,
        enableOnChainRegistration: false,
        executorWallet: wallet,
        chainId: 31337,
      });
      await integration.initialize();

      await expect(integration.withdrawPrepaid(1000n))
        .rejects.toThrow('Registry and wallet required');

      await integration.shutdown();
    });
  });

  describe('On-Chain Sync', () => {
    test('syncFromOnChain skips without registry address', async () => {
      const integration = createTriggerIntegration({
        rpcUrl: RPC_URL,
        enableOnChainRegistration: true,
        chainId: 31337,
      });

      // Should not throw, just skip
      await integration.initialize();
      expect(integration.getTriggers()).toHaveLength(0);

      await integration.shutdown();
    });
  });
});
