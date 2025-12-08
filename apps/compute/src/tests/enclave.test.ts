/**
 * TEE Enclave Tests
 *
 * Tests the TEE enclave:
 * - Initialization and validation
 * - Deterministic wallet derivation
 * - State encryption/decryption
 * - Message and transaction signing
 * - Lifecycle management
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { keccak256, toBytes } from 'viem';
import { TEEEnclave } from '../tee/enclave.js';

describe('TEEEnclave', () => {
  const testConfig = {
    codeHash: keccak256(toBytes('test-code-v1')) as `0x${string}`,
    instanceId: 'test-instance',
  };

  let enclave: TEEEnclave | null = null;

  afterEach(async () => {
    if (enclave) {
      await enclave.shutdown();
      enclave = null;
    }
  });

  describe('initialization', () => {
    it('creates and boots enclave', async () => {
      enclave = await TEEEnclave.create(testConfig);

      const status = enclave.getStatus();
      expect(status.running).toBe(true);
      expect(status.address).toBeDefined();
      expect(status.attestationValid).toBe(true);
    });

    it('rejects invalid code hash', async () => {
      await expect(
        TEEEnclave.create({
          codeHash: 'invalid' as `0x${string}`,
          instanceId: 'test',
        })
      ).rejects.toThrow('Invalid code hash');
    });

    it('rejects empty instance ID', async () => {
      await expect(
        TEEEnclave.create({ codeHash: testConfig.codeHash, instanceId: '' })
      ).rejects.toThrow('Invalid instance ID');
    });

    it('derives deterministic wallet address', async () => {
      const enclave1 = await TEEEnclave.create(testConfig);
      const enclave2 = await TEEEnclave.create(testConfig);

      expect(enclave1.getOperatorAddress()).toBe(enclave2.getOperatorAddress());

      await enclave1.shutdown();
      await enclave2.shutdown();
      enclave = null;
    });

    it('derives different addresses for different instances', async () => {
      const enclave1 = await TEEEnclave.create({
        ...testConfig,
        instanceId: 'instance-1',
      });
      const enclave2 = await TEEEnclave.create({
        ...testConfig,
        instanceId: 'instance-2',
      });

      expect(enclave1.getOperatorAddress()).not.toBe(
        enclave2.getOperatorAddress()
      );

      await enclave1.shutdown();
      await enclave2.shutdown();
      enclave = null;
    });

    it('generates valid attestation', async () => {
      enclave = await TEEEnclave.create(testConfig);

      const attestation = enclave.getAttestation();

      expect(attestation.mrEnclave).toBe(testConfig.codeHash);
      expect(attestation.operatorAddress).toBe(enclave.getOperatorAddress());
      expect(attestation.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('state management', () => {
    const stateConfig = {
      codeHash: keccak256(toBytes('state-test-code')) as `0x${string}`,
      instanceId: 'state-test',
    };

    it('encrypts and decrypts state', async () => {
      enclave = await TEEEnclave.create(stateConfig);

      const state = { game: { score: 100 }, players: ['alice', 'bob'] };

      const { cid, hash } = await enclave.encryptState(state);
      expect(cid).toMatch(/^Qm[a-f0-9]+$/);
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/);

      const sealed = enclave.getSealedState();
      expect(sealed).not.toBeNull();

      const decrypted = await enclave.decryptState(sealed!);
      expect(decrypted).toEqual(state);
    });

    it('updates state version after encryption', async () => {
      enclave = await TEEEnclave.create(stateConfig);

      expect(enclave.getStatus().stateVersion).toBe(0);

      await enclave.encryptState({ value: 1 });

      const status = enclave.getStatus();
      expect(status.stateVersion).toBe(1);
      expect(status.lastUpdate).toBeGreaterThan(0);
    });

    it('rotates state encryption key', async () => {
      enclave = await TEEEnclave.create(stateConfig);

      const state = { important: 'data' };
      await enclave.encryptState(state);
      expect(enclave.getSealedState()?.version).toBe(1);

      const { oldVersion, newVersion, newCid } = await enclave.rotateStateKey();

      expect(oldVersion).toBe(1);
      expect(newVersion).toBe(2);
      expect(newCid).toBeDefined();
      expect(enclave.getSealedState()?.version).toBe(2);

      const decrypted = await enclave.decryptState(enclave.getSealedState()!);
      expect(decrypted).toEqual(state);
    });

    it('fails to rotate without state', async () => {
      enclave = await TEEEnclave.create(stateConfig);
      await expect(enclave.rotateStateKey()).rejects.toThrow('No state');
    });

    it('loads sealed state from another enclave', async () => {
      enclave = await TEEEnclave.create(stateConfig);

      const state = { loaded: true };
      await enclave.encryptState(state);
      const sealed = enclave.getSealedState();

      const enclave2 = await TEEEnclave.create(stateConfig);
      enclave2.loadSealedState(sealed!);

      const decrypted = await enclave2.decryptState(sealed!);
      expect(decrypted).toEqual(state);

      await enclave2.shutdown();
    });
  });

  describe('signing', () => {
    const signingConfig = {
      codeHash: keccak256(toBytes('signing-test')) as `0x${string}`,
      instanceId: 'signing-test',
    };

    it('signs messages', async () => {
      enclave = await TEEEnclave.create(signingConfig);

      const signed = enclave.signMessage('Hello, World!');

      expect(signed.message).toBe('Hello, World!');
      expect(signed.address).toBe(enclave.getOperatorAddress());
      expect(signed.signature).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('produces consistent signatures', async () => {
      enclave = await TEEEnclave.create(signingConfig);

      const signed1 = enclave.signMessage('Same message');
      const signed2 = enclave.signMessage('Same message');

      expect(signed1.signature).toBe(signed2.signature);
    });

    it('produces different signatures for different messages', async () => {
      enclave = await TEEEnclave.create(signingConfig);

      const signed1 = enclave.signMessage('Message 1');
      const signed2 = enclave.signMessage('Message 2');

      expect(signed1.signature).not.toBe(signed2.signature);
    });

    it('signs transactions', async () => {
      enclave = await TEEEnclave.create(signingConfig);

      const tx = enclave.signTransaction(
        '0x1234567890123456789012345678901234567890',
        '0xabcdef',
        100n
      );

      expect(tx.from).toBe(enclave.getOperatorAddress());
      expect(tx.to).toBe('0x1234567890123456789012345678901234567890');
      expect(tx.data).toBe('0xabcdef');
      expect(tx.value).toBe(100n);
      expect(tx.nonce).toBe(0);
    });

    it('increments transaction nonce', async () => {
      enclave = await TEEEnclave.create(signingConfig);

      const tx1 = enclave.signTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x00'
      );
      const tx2 = enclave.signTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x00'
      );

      expect(tx1.nonce).toBe(0);
      expect(tx2.nonce).toBe(1);
    });

    it('generates heartbeat', async () => {
      enclave = await TEEEnclave.create(signingConfig);

      const heartbeat = enclave.generateHeartbeat();

      expect(heartbeat.timestamp).toBeLessThanOrEqual(Date.now());
      expect(heartbeat.stateHash).toBeNull(); // No state yet
      expect(heartbeat.signature).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('includes state hash in heartbeat after encryption', async () => {
      enclave = await TEEEnclave.create(signingConfig);

      await enclave.encryptState({ test: true });
      const heartbeat = enclave.generateHeartbeat();

      expect(heartbeat.stateHash).not.toBeNull();
      expect(heartbeat.stateHash).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });

  describe('lifecycle', () => {
    it('fails operations after shutdown', async () => {
      const enc = await TEEEnclave.create({
        codeHash: keccak256(toBytes('lifecycle-test')) as `0x${string}`,
        instanceId: 'lifecycle',
      });

      await enc.shutdown();

      expect(enc.getStatus().running).toBe(false);
      expect(() => enc.getOperatorAddress()).toThrow('not running');
      expect(() => enc.signMessage('test')).toThrow('not running');
    });
  });
});
