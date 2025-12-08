/**
 * SDK Reputation Integration Tests
 * 
 * Tests the SDK's reputation and dispute functionality
 */

import { describe, test, expect } from 'bun:test';
import { Wallet } from 'ethers';
import {
  DisputeReasonEnum,
  RentalStatusEnum,
  GPUTypeEnum,
} from '../sdk/types';
import type {
  UserRecord,
  ProviderRecord,
  Dispute,
  RentalRating,
  DisputeReason,
} from '../sdk/types';

describe('SDK Reputation Types', () => {
  describe('Type Definitions', () => {
    test('RentalStatusEnum has correct values', () => {
      expect(RentalStatusEnum.PENDING).toBe(0);
      expect(RentalStatusEnum.ACTIVE).toBe(1);
      expect(RentalStatusEnum.PAUSED).toBe(2);
      expect(RentalStatusEnum.COMPLETED).toBe(3);
      expect(RentalStatusEnum.CANCELLED).toBe(4);
      expect(RentalStatusEnum.EXPIRED).toBe(5);
      expect(RentalStatusEnum.DISPUTED).toBe(6);
    });

    test('DisputeReasonEnum has correct values', () => {
      expect(DisputeReasonEnum.NONE).toBe(0);
      expect(DisputeReasonEnum.PROVIDER_OFFLINE).toBe(1);
      expect(DisputeReasonEnum.WRONG_HARDWARE).toBe(2);
      expect(DisputeReasonEnum.POOR_PERFORMANCE).toBe(3);
      expect(DisputeReasonEnum.SECURITY_ISSUE).toBe(4);
      expect(DisputeReasonEnum.USER_ABUSE).toBe(5);
      expect(DisputeReasonEnum.USER_HACK_ATTEMPT).toBe(6);
      expect(DisputeReasonEnum.USER_TERMS_VIOLATION).toBe(7);
      expect(DisputeReasonEnum.PAYMENT_DISPUTE).toBe(8);
    });

    test('GPUTypeEnum has correct values', () => {
      expect(GPUTypeEnum.NONE).toBe(0);
      expect(GPUTypeEnum.NVIDIA_RTX_4090).toBe(1);
      expect(GPUTypeEnum.NVIDIA_A100_40GB).toBe(2);
      expect(GPUTypeEnum.NVIDIA_A100_80GB).toBe(3);
      expect(GPUTypeEnum.NVIDIA_H100).toBe(4);
      expect(GPUTypeEnum.NVIDIA_H200).toBe(5);
      expect(GPUTypeEnum.AMD_MI300X).toBe(6);
      expect(GPUTypeEnum.APPLE_M1_MAX).toBe(7);
      expect(GPUTypeEnum.APPLE_M2_ULTRA).toBe(8);
      expect(GPUTypeEnum.APPLE_M3_MAX).toBe(9);
    });
  });

  describe('Type Structures', () => {
    test('UserRecord type is valid', () => {
      const userRecord: UserRecord = {
        totalRentals: 10,
        completedRentals: 8,
        cancelledRentals: 1,
        disputedRentals: 1,
        abuseReports: 0,
        banned: false,
        bannedAt: 0,
        banReason: '',
      };
      
      expect(userRecord.totalRentals).toBe(10);
      expect(userRecord.banned).toBe(false);
    });

    test('ProviderRecord type is valid', () => {
      const providerRecord: ProviderRecord = {
        totalRentals: 100,
        completedRentals: 95,
        failedRentals: 5,
        totalEarnings: BigInt('1000000000000000000'),
        avgRating: 8500, // 85.00
        ratingCount: 50,
        banned: false,
      };
      
      expect(providerRecord.totalRentals).toBe(100);
      expect(providerRecord.avgRating).toBe(8500);
    });

    test('Dispute type is valid', () => {
      const dispute: Dispute = {
        disputeId: '0x1234567890abcdef',
        rentalId: '0xfedcba0987654321',
        initiator: '0x1111111111111111111111111111111111111111',
        defendant: '0x2222222222222222222222222222222222222222',
        reason: DisputeReasonEnum.PROVIDER_OFFLINE as DisputeReason,
        evidenceUri: 'ipfs://Qm...',
        createdAt: 1700000000,
        resolvedAt: 0,
        resolved: false,
        inFavorOfInitiator: false,
        slashAmount: BigInt(0),
      };
      
      expect(dispute.reason).toBe(DisputeReasonEnum.PROVIDER_OFFLINE);
      expect(dispute.resolved).toBe(false);
    });

    test('RentalRating type is valid', () => {
      const rating: RentalRating = {
        score: 85,
        comment: 'Great service, fast and reliable!',
        ratedAt: 1700000000,
      };
      
      expect(rating.score).toBe(85);
      expect(rating.comment).toContain('Great service');
    });
  });

  describe('Wallet Integration', () => {
    test('can create wallet for signing', () => {
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const wallet = new Wallet(privateKey);
      
      expect(wallet.address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });

    test('can sign messages for auth', async () => {
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const wallet = new Wallet(privateKey);
      
      const message = 'test-message';
      const signature = await wallet.signMessage(message);
      
      expect(signature).toBeDefined();
      expect(signature.length).toBeGreaterThan(100);
    });
  });
});

