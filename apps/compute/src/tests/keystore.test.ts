/**
 * TEE Keystore Tests
 *
 * Tests the keystore with production-quality crypto:
 * - Key derivation from measurement
 * - Key caching and versioning
 * - Sealing/unsealing data
 * - Key rotation
 */

import { describe, expect, it } from 'bun:test';
import { keccak256, toBytes } from 'viem';
import { TEEKeystore } from '../tee/keystore.js';

describe('TEEKeystore', () => {
  const testMeasurement = keccak256(toBytes('test-enclave-measurement'));

  describe('key derivation', () => {
    it('creates keystore from measurement', async () => {
      const keystore = await TEEKeystore.create(testMeasurement);
      expect(keystore).toBeDefined();
    });

    it('rejects invalid measurement', async () => {
      await expect(TEEKeystore.create('')).rejects.toThrow('Invalid');
      await expect(TEEKeystore.create('short')).rejects.toThrow('Invalid');
    });

    it('caches keys for same label', async () => {
      const keystore = await TEEKeystore.create(testMeasurement);

      const key1 = await keystore.deriveKey('test-key');
      const key2 = await keystore.deriveKey('test-key');

      expect(key1).toBe(key2); // Same object reference
    });

    it('derives unique keys per label', async () => {
      const keystore = await TEEKeystore.create(testMeasurement);

      const bytes1 = await keystore.getRawKeyBytes('key1');
      const bytes2 = await keystore.getRawKeyBytes('key2');

      expect(bytes1).not.toEqual(bytes2);
    });

    it('derives unique keys per version', async () => {
      const keystore = await TEEKeystore.create(testMeasurement);

      const bytes1 = await keystore.getRawKeyBytes('test', 1);
      const bytes2 = await keystore.getRawKeyBytes('test', 2);

      expect(bytes1).not.toEqual(bytes2);
    });

    it('tracks key version', async () => {
      const keystore = await TEEKeystore.create(testMeasurement);

      expect(keystore.getKeyVersion('new-key')).toBe(1);

      await keystore.deriveKey('new-key', 1);
      expect(keystore.getKeyVersion('new-key')).toBe(1);

      await keystore.deriveKey('new-key', 3);
      expect(keystore.getKeyVersion('new-key')).toBe(3);
    });

    it('rotates key correctly', async () => {
      const keystore = await TEEKeystore.create(testMeasurement);

      await keystore.deriveKey('rotate-test', 1);
      const oldBytes = await keystore.getRawKeyBytes('rotate-test', 1);

      const { oldVersion, newVersion } =
        await keystore.rotateKey('rotate-test');

      expect(oldVersion).toBe(1);
      expect(newVersion).toBe(2);
      expect(keystore.getKeyVersion('rotate-test')).toBe(2);

      const newBytes = await keystore.getRawKeyBytes('rotate-test', 2);
      expect(newBytes).not.toEqual(oldBytes);
    });

    it('rejects empty label', async () => {
      const keystore = await TEEKeystore.create(testMeasurement);
      await expect(keystore.deriveKey('')).rejects.toThrow('empty');
    });

    it('rejects invalid version', async () => {
      const keystore = await TEEKeystore.create(testMeasurement);
      await expect(keystore.deriveKey('test', 0)).rejects.toThrow('>= 1');
      await expect(keystore.deriveKey('test', -1)).rejects.toThrow('>= 1');
    });
  });

  describe('sealing', () => {
    const measurement = keccak256(toBytes('test-enclave-sealing'));

    it('seals and unseals data', async () => {
      const keystore = await TEEKeystore.create(measurement);
      const data = new TextEncoder().encode('Secret data');

      const sealed = await keystore.seal(data, 'test-label');
      const unsealed = await keystore.unseal(sealed);

      expect(unsealed).toEqual(data);
    });

    it('seals and unseals JSON', async () => {
      const keystore = await TEEKeystore.create(measurement);
      const data = { name: 'Test', value: 42, nested: { a: 1, b: [1, 2, 3] } };

      const sealed = await keystore.sealJSON(data, 'json-label');
      const unsealed = await keystore.unsealJSON(sealed);

      expect(unsealed).toEqual(data);
    });

    it('includes version in sealed data', async () => {
      const keystore = await TEEKeystore.create(measurement);
      const data = new TextEncoder().encode('Test data');

      const sealed = await keystore.seal(data, 'version-test');

      expect(sealed.version).toBe(1);
      expect(sealed.label).toBe('version-test');
    });

    it('seals with rotated key correctly', async () => {
      const keystore = await TEEKeystore.create(measurement);
      const data = new TextEncoder().encode('Data for rotation test');

      const sealed1 = await keystore.seal(data, 'rotate-seal-test');
      expect(sealed1.version).toBe(1);

      await keystore.rotateKey('rotate-seal-test');

      const sealed2 = await keystore.seal(data, 'rotate-seal-test');
      expect(sealed2.version).toBe(2);

      // Both decrypt correctly with their respective versions
      const unsealed1 = await keystore.unseal(sealed1, 1);
      const unsealed2 = await keystore.unseal(sealed2, 2);

      expect(unsealed1).toEqual(data);
      expect(unsealed2).toEqual(data);
      expect(sealed1.payload.ciphertext).not.toBe(sealed2.payload.ciphertext);
    });

    it('rejects empty data', async () => {
      const keystore = await TEEKeystore.create(measurement);
      await expect(keystore.seal(new Uint8Array(0), 'test')).rejects.toThrow(
        'empty'
      );
    });

    it('fails to unseal with wrong version', async () => {
      const keystore = await TEEKeystore.create(measurement);
      const data = new TextEncoder().encode('Test data');

      const sealed = await keystore.seal(data, 'wrong-version-test');

      await expect(keystore.unseal(sealed, 99)).rejects.toThrow();
    });
  });

  describe('determinism', () => {
    it('derives same keys from same measurement', async () => {
      const measurement = keccak256(toBytes('deterministic-test'));

      const keystore1 = await TEEKeystore.create(measurement);
      const keystore2 = await TEEKeystore.create(measurement);

      const bytes1 = await keystore1.getRawKeyBytes('test-key');
      const bytes2 = await keystore2.getRawKeyBytes('test-key');

      expect(bytes1).toEqual(bytes2);
    });

    it('derives different keys from different measurements', async () => {
      const measurement1 = keccak256(toBytes('measurement-1'));
      const measurement2 = keccak256(toBytes('measurement-2'));

      const keystore1 = await TEEKeystore.create(measurement1);
      const keystore2 = await TEEKeystore.create(measurement2);

      const bytes1 = await keystore1.getRawKeyBytes('same-label');
      const bytes2 = await keystore2.getRawKeyBytes('same-label');

      expect(bytes1).not.toEqual(bytes2);
    });
  });
});
