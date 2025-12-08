/**
 * Crypto Module Tests
 *
 * Tests production-quality cryptographic primitives:
 * - AES-256-GCM encryption/decryption
 * - HKDF key derivation
 * - Utility functions (randomBytes, hex conversion, constant-time comparison)
 */

import { describe, expect, it } from 'bun:test';
import {
  bytesToHex,
  constantTimeEqual,
  decrypt,
  decryptString,
  deriveKey,
  deriveKeyWithLabel,
  encrypt,
  encryptString,
  hexToBytes,
  importKey,
  randomBytes,
} from '../crypto/index.js';

describe('AES-256-GCM', () => {
  it('encrypts and decrypts data', async () => {
    const key = await importKey(randomBytes(32));
    const plaintext = new TextEncoder().encode('Hello, World!');

    const encrypted = await encrypt(plaintext, key);
    const decrypted = await decrypt(encrypted, key);

    expect(decrypted).toEqual(plaintext);
  });

  it('encrypts and decrypts strings', async () => {
    const key = await importKey(randomBytes(32));
    const message = 'Test message with unicode: 你好世界';

    const encrypted = await encryptString(message, key);
    const decrypted = await decryptString(encrypted, key);

    expect(decrypted).toBe(message);
  });

  it('produces unique ciphertext per encryption (random IV)', async () => {
    const key = await importKey(randomBytes(32));
    const plaintext = new TextEncoder().encode('Same message');

    const encrypted1 = await encrypt(plaintext, key);
    const encrypted2 = await encrypt(plaintext, key);

    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  it('fails to decrypt with wrong key', async () => {
    const key1 = await importKey(randomBytes(32));
    const key2 = await importKey(randomBytes(32));
    const plaintext = new TextEncoder().encode('Secret data');

    const encrypted = await encrypt(plaintext, key1);

    await expect(decrypt(encrypted, key2)).rejects.toThrow();
  });

  it('detects tampered ciphertext', async () => {
    const key = await importKey(randomBytes(32));
    const plaintext = new TextEncoder().encode('Important data');

    const encrypted = await encrypt(plaintext, key);

    const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
    if (tamperedCiphertext[10] !== undefined) {
      tamperedCiphertext[10] ^= 0xff;
    }
    encrypted.ciphertext = tamperedCiphertext.toString('base64');

    await expect(decrypt(encrypted, key)).rejects.toThrow();
  });

  it('rejects invalid key length', async () => {
    const shortKey = randomBytes(16); // AES-128, but we require AES-256
    await expect(importKey(shortKey)).rejects.toThrow('Invalid key length');
  });
});

describe('HKDF Key Derivation', () => {
  it('derives consistent keys from same input', async () => {
    const ikm = randomBytes(32);

    const key1 = await deriveKey({
      ikm,
      info: new TextEncoder().encode('test'),
      length: 32,
    });
    const key2 = await deriveKey({
      ikm,
      info: new TextEncoder().encode('test'),
      length: 32,
    });

    expect(key1).toEqual(key2);
  });

  it('derives different keys for different info', async () => {
    const ikm = randomBytes(32);

    const key1 = await deriveKey({
      ikm,
      info: new TextEncoder().encode('purpose1'),
      length: 32,
    });
    const key2 = await deriveKey({
      ikm,
      info: new TextEncoder().encode('purpose2'),
      length: 32,
    });

    expect(key1).not.toEqual(key2);
  });

  it('derives different keys for different salt', async () => {
    const ikm = randomBytes(32);
    const info = new TextEncoder().encode('test');

    const key1 = await deriveKey({
      ikm,
      salt: randomBytes(32),
      info,
      length: 32,
    });
    const key2 = await deriveKey({
      ikm,
      salt: randomBytes(32),
      info,
      length: 32,
    });

    expect(key1).not.toEqual(key2);
  });

  it('derives keys of requested length', async () => {
    const ikm = randomBytes(32);
    const info = new TextEncoder().encode('test');

    const key16 = await deriveKey({ ikm, info, length: 16 });
    const key32 = await deriveKey({ ikm, info, length: 32 });
    const key64 = await deriveKey({ ikm, info, length: 64 });

    expect(key16.length).toBe(16);
    expect(key32.length).toBe(32);
    expect(key64.length).toBe(64);
  });

  it('derives key with label helper', async () => {
    const masterKey = randomBytes(32);

    const key1 = await deriveKeyWithLabel(masterKey, 'wallet');
    const key2 = await deriveKeyWithLabel(masterKey, 'encryption');

    expect(key1.length).toBe(32);
    expect(key2.length).toBe(32);
    expect(key1).not.toEqual(key2);
  });

  it('rejects empty IKM', async () => {
    await expect(
      deriveKey({
        ikm: new Uint8Array(0),
        info: new TextEncoder().encode('test'),
        length: 32,
      })
    ).rejects.toThrow('empty');
  });
});

describe('Utility Functions', () => {
  describe('randomBytes', () => {
    it('generates correct length', () => {
      expect(randomBytes(16).length).toBe(16);
      expect(randomBytes(32).length).toBe(32);
      expect(randomBytes(64).length).toBe(64);
    });

    it('generates unique bytes each time', () => {
      const bytes1 = randomBytes(32);
      const bytes2 = randomBytes(32);

      expect(bytes1).not.toEqual(bytes2);
    });

    it('rejects non-positive length', () => {
      expect(() => randomBytes(0)).toThrow('positive');
      expect(() => randomBytes(-1)).toThrow('positive');
    });
  });

  describe('constantTimeEqual', () => {
    it('returns true for equal arrays', () => {
      const a = new Uint8Array([1, 2, 3, 4, 5]);
      const b = new Uint8Array([1, 2, 3, 4, 5]);

      expect(constantTimeEqual(a, b)).toBe(true);
    });

    it('returns false for unequal arrays', () => {
      const a = new Uint8Array([1, 2, 3, 4, 5]);
      const b = new Uint8Array([1, 2, 3, 4, 6]);

      expect(constantTimeEqual(a, b)).toBe(false);
    });

    it('returns false for different length arrays', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3, 4]);

      expect(constantTimeEqual(a, b)).toBe(false);
    });
  });

  describe('hex conversion', () => {
    it('converts bytes to hex', () => {
      const bytes = new Uint8Array([0x00, 0x0f, 0xf0, 0xff]);
      expect(bytesToHex(bytes)).toBe('000ff0ff');
    });

    it('converts hex to bytes', () => {
      const hex = '000ff0ff';
      expect(hexToBytes(hex)).toEqual(new Uint8Array([0x00, 0x0f, 0xf0, 0xff]));
    });

    it('handles 0x prefix', () => {
      const hex = '0x000ff0ff';
      expect(hexToBytes(hex)).toEqual(new Uint8Array([0x00, 0x0f, 0xf0, 0xff]));
    });

    it('rejects odd-length hex strings', () => {
      expect(() => hexToBytes('0f0')).toThrow('even length');
    });
  });
});
