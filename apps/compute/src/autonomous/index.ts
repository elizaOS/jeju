/**
 * Autonomous Module
 *
 * Verification tools for permissionless game operations.
 */

export {
  type AttestationVerification,
  checkTakeoverCapability,
  formatOnChainVerification,
  formatPermissionlessCheck,
  formatVerification,
  type OnChainVerification,
  type PermissionlessCheck,
  type TakeoverCapability,
  verifyAttestation,
  verifyOnChainState,
  verifyPermissionless,
} from './verifier.js';
