#!/usr/bin/env bun

/**
 * Cryptography Verification
 */

import {
  decrypt,
  deriveKeyWithLabel,
  encrypt,
  generateIV,
  importKey,
  randomBytes,
} from './crypto/index.js';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

async function runCryptoAudit(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  console.log('\nCryptography Audit\n');

  function test(name: string, passed: boolean, details: string) {
    results.push({ name, passed, details });
    console.log(`${passed ? '✓' : '✗'} ${name}: ${details}`);
  }

  // Test 1: Web Crypto API
  console.log('Web Crypto API:');
  const hasWebCrypto = typeof crypto?.subtle !== 'undefined';
  test('crypto.subtle', hasWebCrypto, hasWebCrypto ? 'Available' : 'Missing');

  const hasCSPRNG = typeof crypto.getRandomValues === 'function';
  test('getRandomValues', hasCSPRNG, hasCSPRNG ? 'Available' : 'Missing');

  if (!hasWebCrypto || !hasCSPRNG) {
    console.error('\n✗ Web Crypto API not available\n');
    return results;
  }

  // Test 2: Key length
  console.log('\nKey Length:');
  const keyBytes = randomBytes(32);
  test('256-bit key', keyBytes.length === 32, `${keyBytes.length * 8} bits`);

  let rejectedWrongSize = false;
  try {
    await importKey(new Uint8Array(16));
  } catch {
    rejectedWrongSize = true;
  }
  test(
    'Rejects 128-bit',
    rejectedWrongSize,
    rejectedWrongSize ? 'Rejected' : 'Accepted'
  );

  // Test 3: IV randomness
  console.log('\nIV Randomness:');
  const ivs = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    ivs.add(Buffer.from(generateIV()).toString('hex'));
  }
  test('1000 unique IVs', ivs.size === 1000, `${ivs.size} unique`);
  test(
    '96-bit IV',
    generateIV().length === 12,
    `${generateIV().length * 8} bits`
  );

  // Test 4: Non-determinism
  console.log('\nNon-determinism:');
  const key = await importKey(keyBytes);
  const plaintext = new TextEncoder().encode('Test message');
  const ct1 = await encrypt(plaintext, key);
  const ct2 = await encrypt(plaintext, key);
  test(
    'Different ciphertext',
    ct1.ciphertext !== ct2.ciphertext,
    'Random IV working'
  );

  // Test 5: Tamper detection
  console.log('\nTamper Detection:');
  const encrypted = await encrypt(plaintext, key);

  const tampered = Buffer.from(encrypted.ciphertext, 'base64');
  tampered[0] = (tampered[0] ?? 0) ^ 0xff;
  let tamperDetected = false;
  try {
    await decrypt(
      { ...encrypted, ciphertext: tampered.toString('base64') },
      key
    );
  } catch {
    tamperDetected = true;
  }
  test(
    'Ciphertext tamper',
    tamperDetected,
    tamperDetected ? 'Detected' : 'Not detected'
  );

  const tamperedIV = Buffer.from(encrypted.iv, 'base64');
  tamperedIV[0] = (tamperedIV[0] ?? 0) ^ 0xff;
  let ivTamperDetected = false;
  try {
    await decrypt({ ...encrypted, iv: tamperedIV.toString('base64') }, key);
  } catch {
    ivTamperDetected = true;
  }
  test(
    'IV tamper',
    ivTamperDetected,
    ivTamperDetected ? 'Detected' : 'Not detected'
  );

  // Test 6: Wrong key
  console.log('\nKey Verification:');
  const wrongKey = await importKey(randomBytes(32));
  let wrongKeyFails = false;
  try {
    await decrypt(encrypted, wrongKey);
  } catch {
    wrongKeyFails = true;
  }
  test(
    'Wrong key rejected',
    wrongKeyFails,
    wrongKeyFails ? 'Rejected' : 'Accepted'
  );

  // Test 7: Correct key
  const decrypted = await decrypt(encrypted, key);
  const match =
    new TextDecoder().decode(decrypted) === new TextDecoder().decode(plaintext);
  test('Correct key works', match, match ? 'Decrypted' : 'Failed');

  // Test 8: HKDF
  console.log('\nHKDF:');
  const masterKey = randomBytes(32);
  const dk1 = await deriveKeyWithLabel(masterKey, 'encryption', 32);
  const dk2 = await deriveKeyWithLabel(masterKey, 'authentication', 32);
  const dk1Again = await deriveKeyWithLabel(masterKey, 'encryption', 32);

  test(
    'Different labels',
    Buffer.from(dk1).toString('hex') !== Buffer.from(dk2).toString('hex'),
    'Different keys'
  );
  test(
    'Deterministic',
    Buffer.from(dk1).toString('hex') === Buffer.from(dk1Again).toString('hex'),
    'Same key'
  );

  // Test 9: Entropy
  console.log('\nEntropy:');
  const repeating = new Uint8Array(1000).fill(0x41);
  const encRepeating = await encrypt(repeating, key);
  const ctBytes = Buffer.from(encRepeating.ciphertext, 'base64');

  const freq = new Array(256).fill(0);
  for (const byte of ctBytes) freq[byte]++;
  let entropy = 0;
  for (const count of freq) {
    if (count > 0) {
      const p = count / ctBytes.length;
      entropy -= p * Math.log2(p);
    }
  }
  test('High entropy', entropy > 7, `${entropy.toFixed(2)} bits/byte`);

  // Test 10: Algorithm
  test('AES-256-GCM', encrypted.alg === 'AES-256-GCM', encrypted.alg);

  // Summary
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n─────────────────────────────────────`);
  console.log(`Results: ${passed}/${results.length} passed`);
  console.log(`─────────────────────────────────────\n`);

  console.log(
    passed === results.length ? '✓ All tests passed\n' : '✗ Some tests failed\n'
  );
  return results;
}

runCryptoAudit().catch(console.error);
