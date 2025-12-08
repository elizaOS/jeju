/**
 * HKDF (HMAC-based Key Derivation Function)
 *
 * Production-quality key derivation using Web Crypto API.
 * Implements RFC 5869 for proper key derivation.
 */

const HASH_ALGORITHM = 'SHA-256';
const HASH_LENGTH = 32; // SHA-256 output length

export interface HKDFOptions {
  /** Input key material */
  ikm: Uint8Array;
  /** Optional salt (if not provided, a zero-filled salt is used) */
  salt?: Uint8Array;
  /** Context/application-specific info */
  info: Uint8Array;
  /** Desired output key length in bytes */
  length: number;
}

/**
 * Derive a key using HKDF
 *
 * @param options - HKDF parameters
 * @returns Derived key bytes
 */
export async function deriveKey(options: HKDFOptions): Promise<Uint8Array> {
  const { ikm, salt, info, length } = options;

  if (length > 255 * HASH_LENGTH) {
    throw new Error(
      `Requested key length ${length} exceeds maximum ${255 * HASH_LENGTH}`
    );
  }

  if (ikm.length === 0) {
    throw new Error('Input key material cannot be empty');
  }

  // Import the IKM as a key
  const ikmKey = await crypto.subtle.importKey(
    'raw',
    ikm.buffer as ArrayBuffer,
    'HKDF',
    false,
    ['deriveBits']
  );

  const saltBuffer = salt?.buffer ?? new Uint8Array(HASH_LENGTH).buffer;
  const infoBuffer = info.buffer;

  // Derive bits using HKDF
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: HASH_ALGORITHM,
      salt: saltBuffer as ArrayBuffer,
      info: infoBuffer as ArrayBuffer,
    },
    ikmKey,
    length * 8 // deriveBits expects bits, not bytes
  );

  return new Uint8Array(derivedBits);
}

/**
 * Derive a key for a specific purpose using a label string
 */
export async function deriveKeyWithLabel(
  masterKey: Uint8Array,
  label: string,
  length = 32
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  return deriveKey({
    ikm: masterKey,
    info: encoder.encode(label),
    length,
  });
}

/**
 * Derive multiple keys from a single master key
 */
export async function deriveMultipleKeys(
  masterKey: Uint8Array,
  labels: string[],
  length = 32
): Promise<Map<string, Uint8Array>> {
  const keys = new Map<string, Uint8Array>();

  for (const label of labels) {
    const key = await deriveKeyWithLabel(masterKey, label, length);
    keys.set(label, key);
  }

  return keys;
}
