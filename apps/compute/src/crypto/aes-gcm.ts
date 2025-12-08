/**
 * AES-GCM Encryption
 *
 * Production-quality authenticated encryption using Web Crypto API.
 * This replaces the fake XOR "encryption" in the original implementation.
 */

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 128; // 128 bits for authentication tag

export interface EncryptedPayload {
  /** Base64-encoded ciphertext (includes auth tag) */
  ciphertext: string;
  /** Base64-encoded IV */
  iv: string;
  /** Algorithm identifier for future-proofing */
  alg: 'AES-256-GCM';
}

/**
 * Import a raw key for AES-GCM operations
 */
export async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  if (keyBytes.length !== 32) {
    throw new Error(
      `Invalid key length: expected 32 bytes, got ${keyBytes.length}`
    );
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a cryptographically secure random IV
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encrypt(
  plaintext: Uint8Array,
  key: CryptoKey,
  additionalData?: Uint8Array
): Promise<EncryptedPayload> {
  const iv = generateIV();

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv.buffer as ArrayBuffer,
      tagLength: TAG_LENGTH,
      additionalData: additionalData?.buffer as ArrayBuffer | undefined,
    },
    key,
    plaintext.buffer as ArrayBuffer
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    iv: uint8ArrayToBase64(iv),
    alg: 'AES-256-GCM',
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(
  payload: EncryptedPayload,
  key: CryptoKey,
  additionalData?: Uint8Array
): Promise<Uint8Array> {
  if (payload.alg !== 'AES-256-GCM') {
    throw new Error(`Unsupported algorithm: ${payload.alg}`);
  }

  const ciphertext = base64ToUint8Array(payload.ciphertext);
  const iv = base64ToUint8Array(payload.iv);

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      `Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`
    );
  }

  const plaintext = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv.buffer as ArrayBuffer,
      tagLength: TAG_LENGTH,
      additionalData: additionalData?.buffer as ArrayBuffer | undefined,
    },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  return new Uint8Array(plaintext);
}

/**
 * Encrypt a string (UTF-8 encoded)
 */
export async function encryptString(
  plaintext: string,
  key: CryptoKey,
  additionalData?: Uint8Array
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  return encrypt(encoder.encode(plaintext), key, additionalData);
}

/**
 * Decrypt to a string (UTF-8 decoded)
 */
export async function decryptString(
  payload: EncryptedPayload,
  key: CryptoKey,
  additionalData?: Uint8Array
): Promise<string> {
  const plaintext = await decrypt(payload, key, additionalData);
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

// Base64 utilities
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Use Buffer in Node.js/Bun environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  // Fallback for browser
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Use Buffer in Node.js/Bun environment
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  // Fallback for browser
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
