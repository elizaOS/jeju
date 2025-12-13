/**
 * KMS SDK Exports
 */

export {
  // Policy builders
  timeLockedPolicy,
  stakeGatedPolicy,
  roleGatedPolicy,
  agentOwnerPolicy,
  tokenGatedPolicy,
  combineAnd,
  combineOr,
  // Encryption functions
  encryptTimeLocked,
  encryptForStakers,
  encryptForRole,
  encryptForAgent,
  encryptWithPolicy,
} from './encrypt.js';

export {
  // Auth helpers
  createAuthSig,
  createSIWEAuthSig,
  // Decryption functions
  decrypt,
  decryptPublic,
  canDecrypt,
  decryptJSON,
  decryptAndVerify,
} from './decrypt.js';

export {
  // Key generation
  generateSigningKey,
  generateEncryptionKey,
  // Signing functions
  sign,
  personalSign,
  signTypedData,
  // Threshold signing
  thresholdSign,
  thresholdSignTransaction,
  // Key management
  getKey,
  revokeKey,
} from './sign.js';

