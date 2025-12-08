/**
 * Real Storage & Encryption Tests
 *
 * Verifies production-quality crypto is working:
 * - AES-256-GCM encryption/decryption
 * - HKDF key derivation
 * - TEE keystore sealing
 * - TEE enclave end-to-end encryption
 */

import { describe, expect, test } from 'bun:test';
import { type Hex, keccak256, toBytes } from 'viem';
import {
  decrypt,
  decryptString,
  type EncryptedPayload,
  encrypt,
  encryptString,
  generateIV,
  importKey,
} from '../crypto/aes-gcm.js';
import { deriveKey, deriveKeyWithLabel } from '../crypto/hkdf.js';
import { TEEEnclave } from '../tee/enclave.js';
import { TEEKeystore } from '../tee/keystore.js';

describe('AES-256-GCM', () => {
  test('encrypts and decrypts binary data', async () => {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const key = await importKey(keyBytes);
    const plaintext = new TextEncoder().encode('Secret data.');

    const encrypted = await encrypt(plaintext, key);

    expect(encrypted.alg).toBe('AES-256-GCM');
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    const decrypted = await decrypt(encrypted, key);
    expect(new TextDecoder().decode(decrypted)).toBe('Secret data.');
  });

  test('produces unique ciphertext per encryption (random IV)', async () => {
    const key = await importKey(crypto.getRandomValues(new Uint8Array(32)));
    const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

    const encrypted1 = await encrypt(plaintext, key);
    const encrypted2 = await encrypt(plaintext, key);

    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

    // Both decrypt to same value
    expect(await decrypt(encrypted1, key)).toEqual(
      await decrypt(encrypted2, key)
    );
  });

  test('fails to decrypt with wrong key', async () => {
    const key1 = await importKey(crypto.getRandomValues(new Uint8Array(32)));
    const key2 = await importKey(crypto.getRandomValues(new Uint8Array(32)));

    const encrypted = await encrypt(new TextEncoder().encode('Secret'), key1);

    await expect(decrypt(encrypted, key2)).rejects.toThrow();
  });

  test('detects tampered ciphertext', async () => {
    const key = await importKey(crypto.getRandomValues(new Uint8Array(32)));
    const encrypted = await encrypt(new TextEncoder().encode('Secret'), key);

    const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
    const firstByte = tamperedCiphertext[0] ?? 0;
    tamperedCiphertext[0] = firstByte ^ 0xff;

    const tampered: EncryptedPayload = {
      ...encrypted,
      ciphertext: tamperedCiphertext.toString('base64'),
    };

    await expect(decrypt(tampered, key)).rejects.toThrow();
  });

  test('handles unicode strings', async () => {
    const key = await importKey(crypto.getRandomValues(new Uint8Array(32)));
    const message = 'Unicode test: 你好世界 🔐';

    const encrypted = await encryptString(message, key);
    const decrypted = await decryptString(encrypted, key);

    expect(decrypted).toBe(message);
  });

  test('supports additional authenticated data (AAD)', async () => {
    const key = await importKey(crypto.getRandomValues(new Uint8Array(32)));
    const plaintext = new TextEncoder().encode('Secret');
    const aad = new TextEncoder().encode('context');

    const encrypted = await encrypt(plaintext, key, aad);

    // Same AAD works
    const decrypted = await decrypt(encrypted, key, aad);
    expect(new TextDecoder().decode(decrypted)).toBe('Secret');

    // Wrong AAD fails
    await expect(
      decrypt(encrypted, key, new TextEncoder().encode('wrong'))
    ).rejects.toThrow();
    await expect(decrypt(encrypted, key)).rejects.toThrow();
  });

  test('IV is 96 bits (12 bytes)', () => {
    expect(generateIV().length).toBe(12);
  });

  test('rejects invalid key lengths', async () => {
    await expect(importKey(new Uint8Array(16))).rejects.toThrow(
      'Invalid key length'
    );
    await expect(importKey(new Uint8Array(48))).rejects.toThrow(
      'Invalid key length'
    );
  });
});

describe('HKDF Key Derivation', () => {
  test('derives consistent keys from same input', async () => {
    const master = crypto.getRandomValues(new Uint8Array(32));

    const key1 = await deriveKeyWithLabel(master, 'test-key', 32);
    const key2 = await deriveKeyWithLabel(master, 'test-key', 32);

    expect(key1).toEqual(key2);
  });

  test('derives unique keys per label', async () => {
    const master = crypto.getRandomValues(new Uint8Array(32));

    const encKey = await deriveKeyWithLabel(master, 'encryption', 32);
    const sigKey = await deriveKeyWithLabel(master, 'signing', 32);

    expect(encKey).not.toEqual(sigKey);
  });

  test('supports custom output lengths', async () => {
    const master = crypto.getRandomValues(new Uint8Array(32));

    const key16 = await deriveKeyWithLabel(master, 'test', 16);
    const key32 = await deriveKeyWithLabel(master, 'test', 32);
    const key64 = await deriveKeyWithLabel(master, 'test', 64);

    expect(key16.length).toBe(16);
    expect(key32.length).toBe(32);
    expect(key64.length).toBe(64);
  });

  test('supports salt and info parameters', async () => {
    const ikm = crypto.getRandomValues(new Uint8Array(32));
    const salt = new TextEncoder().encode('optional-salt');
    const info = new TextEncoder().encode('context');

    const key = await deriveKey({ ikm, salt, info, length: 32 });

    expect(key.length).toBe(32);
  });

  test('rejects empty input key material', async () => {
    await expect(
      deriveKey({
        ikm: new Uint8Array(0),
        info: new TextEncoder().encode('test'),
        length: 32,
      })
    ).rejects.toThrow('empty');
  });
});

describe('TEE Keystore', () => {
  test('seals and unseals data', async () => {
    const measurement = keccak256(toBytes('test-enclave'));
    const keystore = await TEEKeystore.create(measurement);
    const secret = new TextEncoder().encode('Top secret!');

    const sealed = await keystore.seal(secret, 'game_state');
    expect(sealed.version).toBe(1);
    expect(sealed.label).toBe('game_state');

    const unsealed = await keystore.unseal(sealed);
    expect(new TextDecoder().decode(unsealed)).toBe('Top secret!');
  });

  test('seals and unseals JSON', async () => {
    const measurement = keccak256(toBytes('test-enclave'));
    const keystore = await TEEKeystore.create(measurement);

    const gameState = {
      players: ['alice', 'bob'],
      scores: { alice: 100, bob: 85 },
    };

    const sealed = await keystore.sealJSON(gameState, 'state');
    const unsealed = await keystore.unsealJSON<typeof gameState>(sealed);

    expect(unsealed).toEqual(gameState);
  });

  test('key rotation produces different ciphertext', async () => {
    const measurement = keccak256(toBytes('test-enclave'));
    const keystore = await TEEKeystore.create(measurement);
    const data = new TextEncoder().encode('Secret');

    const sealed1 = await keystore.seal(data, 'rotating_key');
    expect(sealed1.version).toBe(1);

    const { oldVersion, newVersion } = await keystore.rotateKey('rotating_key');
    expect(oldVersion).toBe(1);
    expect(newVersion).toBe(2);

    const sealed2 = await keystore.seal(data, 'rotating_key');
    expect(sealed2.version).toBe(2);
    expect(sealed1.payload.ciphertext).not.toBe(sealed2.payload.ciphertext);
  });

  test('derives deterministic keys from measurement', async () => {
    const measurement = keccak256(toBytes('fixed-measurement'));

    const keystore1 = await TEEKeystore.create(measurement);
    const keystore2 = await TEEKeystore.create(measurement);

    const key1 = await keystore1.getRawKeyBytes('test', 1);
    const key2 = await keystore2.getRawKeyBytes('test', 1);

    expect(key1).toEqual(key2);
  });
});

describe('TEE Enclave End-to-End', () => {
  test('encrypts, stores, and decrypts state', async () => {
    const enclave = await TEEEnclave.create({
      codeHash:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex,
      instanceId: 'test-instance',
    });

    const gameState = {
      turn: 42,
      hiddenCards: ['ace-spades', 'king-hearts'],
    };

    const { cid, hash } = await enclave.encryptState(gameState);
    expect(cid).toBeDefined();
    expect(hash).toBeDefined();

    const sealed = enclave.getSealedState();
    const decrypted = await enclave.decryptState<typeof gameState>(sealed!);
    expect(decrypted).toEqual(gameState);

    await enclave.shutdown();
  });

  test('key rotation re-encrypts state', async () => {
    const enclave = await TEEEnclave.create({
      codeHash:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
      instanceId: 'rotation-test',
    });

    const state = { value: 'initial' };
    await enclave.encryptState(state);

    const { oldVersion, newVersion, newCid } = await enclave.rotateStateKey();
    expect(newVersion).toBe(oldVersion + 1);
    expect(newCid).toBeDefined();

    // State still accessible after rotation
    const sealed = enclave.getSealedState();
    const decrypted = await enclave.decryptState<typeof state>(sealed!);
    expect(decrypted).toEqual(state);

    await enclave.shutdown();
  });

  test('attestation has valid structure', async () => {
    const enclave = await TEEEnclave.create({
      codeHash:
        '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as Hex,
      instanceId: 'attestation-test',
    });

    const attestation = enclave.getAttestation();
    expect(attestation.mrEnclave).toBeDefined();
    expect(attestation.operatorAddress).toBe(enclave.getOperatorAddress());
    expect(attestation.timestamp).toBeLessThanOrEqual(Date.now());

    await enclave.shutdown();
  });

  test('heartbeat includes valid signature', async () => {
    const enclave = await TEEEnclave.create({
      codeHash:
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as Hex,
      instanceId: 'heartbeat-test',
    });

    await enclave.encryptState({ test: true });
    const heartbeat = enclave.generateHeartbeat();

    expect(heartbeat.timestamp).toBeLessThanOrEqual(Date.now());
    expect(heartbeat.stateHash).toBeDefined();
    expect(heartbeat.signature).toMatch(/^0x/);

    await enclave.shutdown();
  });
});

describe('Encryption Strength', () => {
  test('ciphertext has high entropy (not predictable)', async () => {
    const key = await importKey(crypto.getRandomValues(new Uint8Array(32)));
    const plaintext = new Uint8Array(1024).fill(0x41); // All 'A's

    const encrypted = await encrypt(plaintext, key);
    const ciphertextBytes = Buffer.from(encrypted.ciphertext, 'base64');

    // Count byte frequency - should be roughly uniform
    const frequency = new Array(256).fill(0);
    for (const byte of ciphertextBytes) {
      frequency[byte]++;
    }

    const maxFreq = Math.max(...frequency);
    const avgFreq = ciphertextBytes.length / 256;

    // Max frequency shouldn't dominate (indicates randomness)
    expect(maxFreq).toBeLessThan(avgFreq * 5);
  });

  test('IVs are cryptographically unique', () => {
    const ivs = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      const iv = generateIV();
      ivs.add(Buffer.from(iv).toString('hex'));
    }

    expect(ivs.size).toBe(1000);
  });

  test('encryption key is 256 bits', async () => {
    const measurement = keccak256(toBytes('test'));
    const keystore = await TEEKeystore.create(measurement);
    const keyBytes = await keystore.getRawKeyBytes('test', 1);

    expect(keyBytes.length).toBe(32); // 256 bits
  });
});
