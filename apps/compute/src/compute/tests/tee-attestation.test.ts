/**
 * TEE Attestation and dStack Integration Tests
 *
 * Tests for:
 * - TEE status detection (simulated vs real)
 * - Node type detection (CPU vs GPU)
 * - Attestation generation and verification
 * - dStack simulator integration
 *
 * Run with: bun test src/compute/tests/tee-attestation.test.ts
 */

import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { Wallet } from 'ethers';
import { detectHardware, formatHardwareInfo } from '../node/hardware';
import {
  generateAttestation,
  verifyAttestation,
  getAttestationHash,
  isAttestationFresh,
} from '../node/attestation';
import { ComputeNodeServer } from '../node/server';
import { DStackClient } from '../../infra/dstack-integration';
import type { HardwareInfo, AttestationReport, TEEStatus } from '../node/types';

// Test wallet
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('TEE Attestation System', () => {
  let wallet: Wallet;
  let hardware: HardwareInfo;

  beforeAll(async () => {
    wallet = new Wallet(TEST_PRIVATE_KEY);
    hardware = await detectHardware();
    
    console.log('\n📋 Detected Hardware:');
    console.log(formatHardwareInfo(hardware));
    console.log('');
  });

  describe('Hardware Detection', () => {
    test('detects platform and architecture', () => {
      expect(['darwin', 'linux', 'win32']).toContain(hardware.platform);
      expect(['arm64', 'x64']).toContain(hardware.arch);
    });

    test('detects CPU info', () => {
      expect(hardware.cpus).toBeGreaterThan(0);
      expect(hardware.memory).toBeGreaterThan(0);
      expect(hardware.cpuModel).toBeDefined();
    });

    test('classifies node type correctly', () => {
      expect(['cpu', 'gpu']).toContain(hardware.nodeType);
      
      if (hardware.gpuType) {
        expect(hardware.nodeType).toBe('gpu');
      } else {
        expect(hardware.nodeType).toBe('cpu');
      }
    });

    test('has TEE info structure', () => {
      expect(hardware.teeInfo).toBeDefined();
      expect(hardware.teeInfo.status).toBeDefined();
      expect(typeof hardware.teeInfo.isReal).toBe('boolean');
    });

    test('TEE status is valid enum value', () => {
      const validStatuses: TEEStatus[] = [
        'none', 'simulated', 'dstack-simulator', 'intel-tdx', 'amd-sev', 'aws-nitro'
      ];
      expect(validStatuses).toContain(hardware.teeInfo.status);
    });

    test('simulated TEE has warning message', () => {
      if (!hardware.teeInfo.isReal) {
        expect(hardware.teeInfo.warning).toBeDefined();
        expect(hardware.teeInfo.warning).toContain('⚠️');
      }
    });
  });

  describe('Attestation Generation', () => {
    let attestation: AttestationReport;

    beforeAll(async () => {
      attestation = await generateAttestation(wallet, 'test-nonce-123');
    });

    test('generates attestation with signing address', () => {
      expect(attestation.signingAddress).toBe(wallet.address);
    });

    test('includes hardware info', () => {
      expect(attestation.hardware).toBeDefined();
      expect(attestation.hardware.platform).toBe(hardware.platform);
      expect(attestation.hardware.nodeType).toBe(hardware.nodeType);
    });

    test('includes nonce', () => {
      expect(attestation.nonce).toBe('test-nonce-123');
    });

    test('includes timestamp', () => {
      expect(attestation.timestamp).toBeDefined();
      const timestamp = new Date(attestation.timestamp).getTime();
      expect(timestamp).toBeGreaterThan(Date.now() - 60000); // Within last minute
    });

    test('includes signature', () => {
      expect(attestation.signature).toBeDefined();
      expect(attestation.signature).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    test('has TEE status fields', () => {
      expect(attestation.teeStatus).toBeDefined();
      expect(typeof attestation.teeIsReal).toBe('boolean');
      expect(typeof attestation.simulated).toBe('boolean');
    });

    test('simulated flag matches teeIsReal', () => {
      expect(attestation.simulated).toBe(!attestation.teeIsReal);
    });

    test('has warning for non-production TEE', () => {
      if (!attestation.teeIsReal) {
        expect(attestation.teeWarning).toBeDefined();
        expect(attestation.teeWarning).toContain('⚠️');
      } else {
        expect(attestation.teeWarning).toBeNull();
      }
    });

    test('generates different signatures for different nonces', async () => {
      const attestation2 = await generateAttestation(wallet, 'different-nonce');
      expect(attestation2.signature).not.toBe(attestation.signature);
    });
  });

  describe('Attestation Verification', () => {
    let attestation: AttestationReport;

    beforeAll(async () => {
      attestation = await generateAttestation(wallet, 'verify-test-nonce');
    });

    test('valid attestation passes verification', async () => {
      const result = await verifyAttestation(attestation, wallet.address);
      expect(result.valid).toBe(true);
    });

    test('wrong address fails verification', async () => {
      const wrongAddress = '0x0000000000000000000000000000000000000001';
      const result = await verifyAttestation(attestation, wrongAddress);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('mismatch');
    });

    test('requireRealTEE fails for simulated attestation', async () => {
      if (!attestation.teeIsReal) {
        const result = await verifyAttestation(attestation, wallet.address, true);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Real TEE required');
      }
    });

    test('includes warnings for simulated TEE', async () => {
      const result = await verifyAttestation(attestation, wallet.address);
      if (!attestation.teeIsReal) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Attestation Hash', () => {
    test('generates consistent hash for same attestation', async () => {
      const attestation = await generateAttestation(wallet, 'hash-test-nonce');
      const hash1 = getAttestationHash(attestation);
      const hash2 = getAttestationHash(attestation);
      expect(hash1).toBe(hash2);
    });

    test('hash is bytes32 format', async () => {
      const attestation = await generateAttestation(wallet, 'hash-format-test');
      const hash = getAttestationHash(attestation);
      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test('different attestations have different hashes', async () => {
      const att1 = await generateAttestation(wallet, 'hash-diff-1');
      const att2 = await generateAttestation(wallet, 'hash-diff-2');
      expect(getAttestationHash(att1)).not.toBe(getAttestationHash(att2));
    });
  });

  describe('Attestation Freshness', () => {
    test('fresh attestation is detected as fresh', async () => {
      const attestation = await generateAttestation(wallet, 'fresh-test');
      expect(isAttestationFresh(attestation)).toBe(true);
    });

    test('old attestation is detected as stale', async () => {
      const attestation = await generateAttestation(wallet, 'stale-test');
      // Manually set old timestamp
      const oldAttestation = {
        ...attestation,
        timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      };
      expect(isAttestationFresh(oldAttestation)).toBe(false);
    });

    test('custom max age is respected', async () => {
      const attestation = await generateAttestation(wallet, 'custom-age-test');
      const oldAttestation = {
        ...attestation,
        timestamp: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
      };
      // 5 second max age should fail
      expect(isAttestationFresh(oldAttestation, 5000)).toBe(false);
      // 20 second max age should pass
      expect(isAttestationFresh(oldAttestation, 20000)).toBe(true);
    });
  });

  describe('DStack Client', () => {
    let dstack: DStackClient;

    beforeAll(() => {
      dstack = new DStackClient();
    });

    test('detects TEE environment correctly', () => {
      // Without DSTACK_SIMULATOR_ENDPOINT, should return false
      const hasEnv = process.env.DSTACK_SIMULATOR_ENDPOINT !== undefined;
      expect(dstack.isRunningInTEE()).toBe(hasEnv);
    });

    test('derives deterministic keys', async () => {
      const key1 = await dstack.deriveKey('/test/path', 'subject1');
      const key2 = await dstack.deriveKey('/test/path', 'subject1');
      // Same path+subject = same key
      expect(Buffer.from(key1).toString('hex')).toBe(Buffer.from(key2).toString('hex'));
    });

    test('different subjects produce different keys', async () => {
      const key1 = await dstack.deriveKey('/test/path', 'subject1');
      const key2 = await dstack.deriveKey('/test/path', 'subject2');
      expect(Buffer.from(key1).toString('hex')).not.toBe(Buffer.from(key2).toString('hex'));
    });

    test('getWallet returns valid address', async () => {
      const wallet = await dstack.getWallet();
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test('generateAttestation returns quote', async () => {
      const attestation = await dstack.generateAttestation('0x1234' as `0x${string}`);
      expect(attestation.quote).toBeDefined();
      expect(attestation.eventLog).toBeDefined();
    });

    test('seal and unseal work correctly', async () => {
      const data = new TextEncoder().encode('secret data');
      const sealed = await dstack.seal(data);
      const unsealed = await dstack.unseal(sealed);
      expect(new TextDecoder().decode(unsealed)).toBe('secret data');
    });
  });

  describe('Compute Node Server TEE Integration', () => {
    let server: ComputeNodeServer;
    const port = 8099;
    let serverUrl: string;

    beforeAll(async () => {
      server = new ComputeNodeServer({
        privateKey: TEST_PRIVATE_KEY,
        registryAddress: '',
        ledgerAddress: '',
        inferenceAddress: '',
        rpcUrl: 'http://localhost:8545',
        port,
        models: [
          {
            name: 'test-model',
            backend: 'mock',
            pricePerInputToken: 1000000000n,
            pricePerOutputToken: 2000000000n,
            maxContextLength: 4096,
          },
        ],
      });
      
      await server.start(port);
      serverUrl = `http://localhost:${port}`;
    });

    afterAll(() => {
      server.stop();
    });

    test('health endpoint includes TEE status', async () => {
      const response = await fetch(`${serverUrl}/health`);
      const data = await response.json() as {
        status: string;
        nodeType: string;
        tee: {
          status: string;
          isReal: boolean;
          warning: string | null;
        };
      };

      expect(data.status).toBe('ok');
      expect(data.nodeType).toBeDefined();
      expect(data.tee).toBeDefined();
      expect(data.tee.status).toBeDefined();
      expect(typeof data.tee.isReal).toBe('boolean');
    });

    test('attestation endpoint returns TEE notice', async () => {
      const response = await fetch(`${serverUrl}/v1/attestation/report`);
      const data = await response.json() as {
        teeStatus: string;
        teeIsReal: boolean;
        teeWarning: string | null;
        _tee_notice: string;
      };

      expect(data.teeStatus).toBeDefined();
      expect(data._tee_notice).toBeDefined();
      
      if (!data.teeIsReal) {
        expect(data._tee_notice).toContain('⚠️');
      }
    });

    test('hardware endpoint shows node type', async () => {
      const response = await fetch(`${serverUrl}/v1/hardware`);
      const data = await response.json() as {
        nodeType: string;
        teeInfo: {
          status: string;
          isReal: boolean;
        };
      };

      expect(['cpu', 'gpu']).toContain(data.nodeType);
      expect(data.teeInfo).toBeDefined();
    });
  });
});

console.log('\n🧪 TEE Attestation Test Suite');
console.log('==============================\n');
console.log('Testing TEE status detection, attestation, and dStack integration.\n');
