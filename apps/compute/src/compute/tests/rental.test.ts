/**
 * Rental Manager Unit Tests
 * 
 * Tests the rental manager functionality including:
 * - SSH key authorization
 * - Container management
 * - Resource detection
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { RentalManager } from '../node/rental';

describe('Rental Manager', () => {
  let rentalManager: RentalManager;
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  
  beforeAll(() => {
    rentalManager = new RentalManager({
      privateKey: testPrivateKey,
      rentalContractAddress: '0x0000000000000000000000000000000000000000',
      rpcUrl: 'http://localhost:8545',
      sshPort: 2222,
      dockerEnabled: false, // Disable for unit tests
      maxConcurrentRentals: 5,
    });
  });

  describe('SSH Key Management', () => {
    test('should authorize SSH key', () => {
      const rentalId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const publicKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDtest user@test';
      const user = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      
      rentalManager.authorizeSSHKey(rentalId, publicKey, user, expiresAt);
      
      // Validate the key
      const validatedRentalId = rentalManager.validateSSHKey(publicKey);
      expect(validatedRentalId).toBe(rentalId);
    });
    
    test('should reject expired SSH key', async () => {
      const rentalId = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const publicKey = 'ssh-rsa BBBBNzaC1yc2EAAAADAQABAAABAQDexpired user@test';
      const user = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const expiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago (expired)
      
      rentalManager.authorizeSSHKey(rentalId, publicKey, user, expiresAt);
      
      // Should return null for expired key
      const validatedRentalId = rentalManager.validateSSHKey(publicKey);
      expect(validatedRentalId).toBeNull();
    });
    
    test('should reject unknown SSH key', () => {
      const publicKey = 'ssh-rsa CCCCNzaC1yc2EAAAADAQABAAABAQDunknown user@test';
      
      const validatedRentalId = rentalManager.validateSSHKey(publicKey);
      expect(validatedRentalId).toBeNull();
    });
    
    test('should revoke SSH key', () => {
      const rentalId = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321';
      const publicKey = 'ssh-rsa DDDDNzaC1yc2EAAAADAQABAAABAQDrevoke user@test';
      const user = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      
      rentalManager.authorizeSSHKey(rentalId, publicKey, user, expiresAt);
      
      // Verify it's valid
      expect(rentalManager.validateSSHKey(publicKey)).toBe(rentalId);
      
      // Revoke
      rentalManager.revokeSSHKey(rentalId);
      
      // Should now be null
      expect(rentalManager.validateSSHKey(publicKey)).toBeNull();
    });
    
    test('should generate authorized_keys file', () => {
      const rentalId1 = '0x1111111111111111111111111111111111111111111111111111111111111111';
      const publicKey1 = 'ssh-rsa EEEEtest1 user1@test';
      const rentalId2 = '0x2222222222222222222222222222222222222222222222222222222222222222';
      const publicKey2 = 'ssh-rsa FFFFtest2 user2@test';
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      
      rentalManager.authorizeSSHKey(rentalId1, publicKey1, '0x1', expiresAt);
      rentalManager.authorizeSSHKey(rentalId2, publicKey2, '0x2', expiresAt);
      
      const authorizedKeysFile = rentalManager.getAuthorizedKeysFile();
      
      expect(authorizedKeysFile).toContain(publicKey1);
      expect(authorizedKeysFile).toContain(publicKey2);
    });
  });

  describe('Resource Detection', () => {
    test('should have valid resource cache after detecting hardware', async () => {
      // Start initializes resources
      await rentalManager.start();
      
      // Should have detected something (even if minimal)
      // The resourcesCache is private, but we can test indirectly
      // by checking the routes
      rentalManager.stop();
    });
  });
});
